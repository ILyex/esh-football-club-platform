package dz.esh.footballclub.publicapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/** Maintains one persistent, system-rendered live score per active match. */
object LiveMatchNotifications {
    private const val CHANNEL = "esh_public_live_updates_v3"
    private const val PREFS = "esh_public_supporters"
    private const val TRACKED_MATCHES = "tracked_live_matches"
    private const val LIVE_STATES = "live_match_states"
    private const val NOTIFICATION_REVISION = "4"

    fun trackedMatches(context: Context): Set<String> =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(TRACKED_MATCHES, emptySet())?.toSet().orEmpty()

    fun isTracking(context: Context, matchId: String): Boolean = matchId in trackedMatches(context)

    /** Reconciles active notifications when the public feed is first loaded or refreshed. */
    fun sync(context: Context, matches: List<PublicMatch>) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val previous = runCatching { JSONObject(prefs.getString(LIVE_STATES, "{}") ?: "{}") }.getOrDefault(JSONObject())
        val tracked = trackedMatches(context)
        val allMatches = matches.associateBy { it.id }
        tracked.filter { id -> allMatches[id]?.status?.let { it != "LIVE" } == true }
            .forEach { finish(context, it) }
        val activeMatches = matches.filter { it.status == "LIVE" }.associateBy { it.id }
        if (activeMatches.isNotEmpty()) {
            prefs.edit().putStringSet(TRACKED_MATCHES, trackedMatches(context) + activeMatches.keys).apply()
        }
        val active = activeMatches
        val next = JSONObject()

        active.values.forEach { match ->
            val signature = listOf(NOTIFICATION_REVISION, match.home, match.away, match.homeScore, match.awayScore, match.category).joinToString("|")
            next.put(match.id, signature)
            if (previous.optString(match.id) != signature) {
                update(context, mapOf(
                    "matchId" to match.id,
                    "kind" to "GOAL",
                    "homeTeamName" to match.home,
                    "awayTeamName" to match.away,
                    "homeScore" to (match.homeScore ?: 0).toString(),
                    "awayScore" to (match.awayScore ?: 0).toString()
                ))
            }
        }
        previous.keys().asSequence().filterNot { it in active }.forEach { cancelNotification(context, it) }
        prefs.edit().putString(LIVE_STATES, next.toString()).apply()
    }

    fun update(context: Context, data: Map<String, String>) {
        val matchId = data["matchId"]?.takeIf(String::isNotBlank) ?: return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (matchId !in trackedMatches(context)) {
            val kind = data["kind"]
            if (kind !in setOf("MATCH_STARTED", "MATCH_REOPENED", "GOAL")) return
            prefs.edit().putStringSet(TRACKED_MATCHES, trackedMatches(context) + matchId).apply()
        }

        val score = "${data["homeScore"]?.toIntOrNull() ?: 0}–${data["awayScore"]?.toIntOrNull() ?: 0}"
        val locale = prefs.getString(PublicMessagingService.LOCALE, "ar") ?: "ar"
        val channelId = if (locale == "fr") "${CHANNEL}_fr" else "${CHANNEL}_ar"
        val isArabic = locale == "ar"
        val stadium = cachedMatch(context, matchId, locale)?.stadium?.takeIf(String::isNotBlank)
        val venue = stadium ?: if (isArabic) "الملعب غير محدد" else "Stade non indiqué"

        ensureChannel(context, locale, channelId)
        val notificationTag = "esh-live-match-$matchId"
        val notificationId = matchId.hashCode()
        val openIntent = PendingIntent.getActivity(
            context,
            notificationId,
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("open_tab", "matches")
                .putExtra("match_id", matchId)
                .putExtra("compact_live_match", true),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.esh_notification_logo)
            .setLargeIcon(android.graphics.BitmapFactory.decodeResource(context.resources, R.drawable.esh_logo))
            .setContentTitle(score)
            .setContentText(venue)
            .setShortCriticalText(score)
            .setColor(0xFFD60A35.toInt())
            .setRequestPromotedOngoing(true)
            .setContentIntent(openIntent)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
        builder.setStyle(NotificationCompat.BigTextStyle().bigText(venue))
        val notification = builder.build()
        if (Build.VERSION.SDK_INT >= 36) {
            val manager = context.getSystemService(NotificationManager::class.java)
            val eligible = NotificationCompat.hasPromotableCharacteristics(notification)
            val allowed = manager.canPostPromotedNotifications()
            if (!eligible || !allowed) {
                Log.w("ESH-LiveUpdate", "Match $matchId live update not promoted eligible=$eligible allowed=$allowed sdk=${Build.VERSION.SDK_INT}")
            } else {
                Log.i("ESH-LiveUpdate", "Match $matchId live update is promotable")
            }
        }
        runCatching { NotificationManagerCompat.from(context).notify(notificationTag, notificationId, notification) }
            .onFailure { Log.e("ESH-LiveUpdate", "Failed to post live update for match $matchId", it) }

        // The system status chip is owned by Android/OEM and cannot contain an
        // arbitrary two-logo layout. Decorate the expanded notification with
        // both team crests, using the last public snapshot already cached by the app.
        loadTeamLogos(context.applicationContext, matchId, locale) { logos ->
            if (logos == null) return@loadTeamLogos
            val decorated = NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.drawable.esh_notification_logo)
                .setLargeIcon(logos)
                .setContentTitle(score)
                .setContentText(venue)
                .setShortCriticalText(score)
                .setColor(0xFFD60A35.toInt())
                .setRequestPromotedOngoing(true)
                .setContentIntent(openIntent)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
            decorated.setStyle(NotificationCompat.BigTextStyle().bigText(venue))
            runCatching { NotificationManagerCompat.from(context).notify(notificationTag, notificationId, decorated.build()) }
                .onFailure { Log.w("ESH-LiveUpdate", "Could not decorate live update with team crests", it) }
        }
    }

    private fun cachedMatch(context: Context, matchId: String, locale: String): PublicMatch? = runCatching {
        val snapshot = PublicApi.cachedSnapshot(context, locale)
            ?: PublicApi.cachedSnapshot(context, if (locale == "fr") "ar" else "fr")
            ?: return@runCatching null
        (snapshot.matches + snapshot.results).firstOrNull { it.id == matchId }
    }.getOrNull()

    private fun loadTeamLogos(context: Context, matchId: String, locale: String, callback: (Bitmap?) -> Unit) {
        thread(name = "esh-match-notification-logos") {
            val bitmap = runCatching {
                val snapshot = PublicApi.cachedSnapshot(context, locale)
                    ?: PublicApi.cachedSnapshot(context, if (locale == "fr") "ar" else "fr")
                    ?: return@runCatching null
                val match = (snapshot.matches + snapshot.results).firstOrNull { it.id == matchId } ?: return@runCatching null
                val homeLogo = if (match.isHomeFixture) snapshot.club.logo else match.opponentLogo
                val awayLogo = if (match.isHomeFixture) match.opponentLogo else snapshot.club.logo
                val home = downloadLogo(homeLogo) ?: return@runCatching null
                val away = downloadLogo(awayLogo) ?: return@runCatching null
                composeLogoPair(home, away)
            }.onFailure { Log.w("ESH-LiveUpdate", "Team crests unavailable for match $matchId", it) }.getOrNull()
            callback(bitmap)
        }
    }

    private fun downloadLogo(rawUrl: String?): Bitmap? {
        val url = rawUrl?.takeIf { it.startsWith("https://") } ?: return null
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 3_000
            readTimeout = 3_000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "ESH-Android")
        }
        return try {
            connection.inputStream.use { BitmapFactory.decodeStream(it) }
        } finally {
            connection.disconnect()
        }
    }

    private fun composeLogoPair(home: Bitmap, away: Bitmap): Bitmap {
        val width = 128
        val height = 128
        val output = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        paint.color = 0xFF171719.toInt()
        canvas.drawRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), 26f, 26f, paint)
        drawCircularLogo(canvas, home, RectF(7f, 40f, 55f, 88f), paint)
        drawCircularLogo(canvas, away, RectF(73f, 40f, 121f, 88f), paint)
        paint.color = 0xFFD60A35.toInt()
        canvas.drawCircle(64f, 64f, 3f, paint)
        return output
    }

    private fun drawCircularLogo(canvas: Canvas, bitmap: Bitmap, bounds: RectF, paint: Paint) {
        val save = canvas.save()
        canvas.clipPath(android.graphics.Path().apply { addOval(bounds, android.graphics.Path.Direction.CW) })
        val side = minOf(bitmap.width, bitmap.height)
        val left = (bitmap.width - side) / 2
        val top = (bitmap.height - side) / 2
        canvas.drawBitmap(bitmap, android.graphics.Rect(left, top, left + side, top + side), bounds, paint)
        canvas.restoreToCount(save)
    }

    fun finish(context: Context, matchId: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val states = runCatching { JSONObject(prefs.getString(LIVE_STATES, "{}") ?: "{}") }.getOrDefault(JSONObject())
        states.remove(matchId)
        prefs.edit()
            .putStringSet(TRACKED_MATCHES, trackedMatches(context) - matchId)
            .putString(LIVE_STATES, states.toString())
            .apply()
        cancelNotification(context, matchId)
    }

    private fun cancelNotification(context: Context, matchId: String) {
        NotificationManagerCompat.from(context).cancel("esh-live-match-$matchId", matchId.hashCode())
    }

    private fun ensureChannel(context: Context, locale: String, channelId: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                channelId,
                if (locale == "fr") "Matchs en direct" else "المباريات المباشرة",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = if (locale == "fr") "Score et événements du match en cours" else "نتيجة المباراة الجارية وتحديثاتها المباشرة"
                setShowBadge(false)
            }
        )
    }
}
