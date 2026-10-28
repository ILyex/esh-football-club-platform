package dz.esh.footballclub.publicapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject

/** Maintains one persistent, system-rendered live score per active match. */
object LiveMatchNotifications {
    private const val CHANNEL = "esh_public_live_updates_v2"
    private const val PREFS = "esh_public_supporters"
    private const val TRACKED_MATCHES = "tracked_live_matches"
    private const val LIVE_STATES = "live_match_states"

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
            val signature = listOf(match.home, match.away, match.homeScore, match.awayScore, match.category).joinToString("|")
            next.put(match.id, signature)
            if (previous.optString(match.id) != signature) {
                val title = if (prefs.getString(PublicMessagingService.LOCALE, "ar") == "ar") "⚽ المباراة مباشرة" else "⚽ Match en direct"
                update(context, mapOf(
                    "matchId" to match.id,
                    "kind" to "GOAL",
                    "homeTeamName" to match.home,
                    "awayTeamName" to match.away,
                    "homeScore" to (match.homeScore ?: 0).toString(),
                    "awayScore" to (match.awayScore ?: 0).toString()
                ), title)
            }
        }
        previous.keys().asSequence().filterNot { it in active }.forEach { cancelNotification(context, it) }
        prefs.edit().putString(LIVE_STATES, next.toString()).apply()
    }

    fun update(context: Context, data: Map<String, String>, eventTitle: String) {
        val matchId = data["matchId"]?.takeIf(String::isNotBlank) ?: return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (matchId !in trackedMatches(context)) {
            val kind = data["kind"]
            if (kind !in setOf("MATCH_STARTED", "MATCH_REOPENED", "GOAL")) return
            prefs.edit().putStringSet(TRACKED_MATCHES, trackedMatches(context) + matchId).apply()
        }

        val home = data["homeTeamName"].orEmpty()
        val away = data["awayTeamName"].orEmpty()
        val score = "${data["homeScore"]?.toIntOrNull() ?: 0}–${data["awayScore"]?.toIntOrNull() ?: 0}"
        val locale = prefs.getString(PublicMessagingService.LOCALE, "ar") ?: "ar"
        val channelId = if (locale == "fr") "${CHANNEL}_fr" else "${CHANNEL}_ar"
        val isArabic = locale == "ar"
        val minute = data["minute"]?.takeIf(String::isNotBlank)
        val liveTitle = if (isArabic) "⚽ ESH · مباشر" else "⚽ ESH · EN DIRECT"
        val teams = listOf(home, score, away).filter(String::isNotBlank).joinToString("   ")
        val progress = if (minute != null) {
            if (isArabic) "الدقيقة $minute′" else "${minute}e min"
        } else if (isArabic) "مباراة مباشرة" else "Match en direct"
        val expanded = listOf(teams, progress, eventTitle).filter(String::isNotBlank).joinToString("\n")

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
        val stopIntent = PendingIntent.getBroadcast(
            context,
            notificationId,
            Intent(context, StopLiveMatchReceiver::class.java).putExtra("match_id", matchId),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_notification_public)
            .setLargeIcon(android.graphics.BitmapFactory.decodeResource(context.resources, R.drawable.esh_logo))
            .setContentTitle(liveTitle)
            .setContentText("$teams  ·  $progress")
            .setStyle(NotificationCompat.BigTextStyle().bigText(expanded))
            .setShortCriticalText(score)
            .setRequestPromotedOngoing(true)
            .setContentIntent(openIntent)
            .addAction(
                R.drawable.ic_notification_public,
                if (isArabic) "إيقاف المتابعة" else "Arrêter le suivi",
                stopIntent
            )
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .build()
        runCatching { NotificationManagerCompat.from(context).notify(notificationTag, notificationId, notification) }
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

    fun stop(context: Context, matchId: String) {
        finish(context, matchId)
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

class StopLiveMatchReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        intent.getStringExtra("match_id")?.takeIf(String::isNotBlank)?.let { LiveMatchNotifications.stop(context, it) }
    }
}
