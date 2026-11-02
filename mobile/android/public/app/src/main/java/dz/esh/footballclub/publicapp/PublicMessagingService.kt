package dz.esh.footballclub.publicapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONArray
import org.json.JSONObject
import kotlin.concurrent.thread

class PublicMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        val locale = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(LOCALE, "ar") ?: "ar"
        registerToken(applicationContext, token, locale)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        if (message.data["section"] != "matches") {
            Log.w("ESH-FCM", "Discarded a message with an unknown section")
            return
        }
        val title = message.data["title"] ?: run {
            Log.w("ESH-FCM", "Discarded a match message without a title")
            return
        }
        val body = message.data["body"].orEmpty()
        val tag = message.data["tag"] ?: message.messageId ?: System.currentTimeMillis().toString()
        val kind = message.data["kind"] ?: "MATCH_UPDATE"
        Log.i("ESH-FCM", "Received match update kind=$kind")
        val locale = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(LOCALE, "ar") ?: "ar"
        val channelId = if (locale == "fr") "${CHANNEL}_fr" else "${CHANNEL}_ar"
        val id = "public-$tag"
        saveAlert(applicationContext, PublicAlert(id, title, body, System.currentTimeMillis(), kind))
        val matchId = message.data["matchId"]
        if (matchId != null) {
            when (kind) {
                "MATCH_STARTED", "MATCH_REOPENED", "GOAL" -> LiveMatchNotifications.update(this, message.data)
                "MATCH_FINISHED" -> LiveMatchNotifications.finish(this, matchId)
            }
        }
        // The persistent Live Update already announces kickoff/resumption.
        // Keep a separate alert only for goals and the final whistle.
        if (kind == "MATCH_STARTED" || kind == "MATCH_REOPENED") return
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(NotificationChannel(
                channelId,
                if (locale == "fr") "Résultats et actualités des matchs" else "أخبار المباريات",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = if (locale == "fr") "Buts et informations des matchs en direct" else "أهداف وتحديثات المباريات المباشرة"
                enableVibration(true)
                setShowBadge(true)
            })
        }
        val openApp = PendingIntent.getActivity(this, tag.hashCode(), Intent(this, MainActivity::class.java).putExtra("open_tab", "alerts"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.esh_notification_logo)
            .setLargeIcon(android.graphics.BitmapFactory.decodeResource(resources, R.drawable.esh_logo))
            .setColor(0xFFD60A35.toInt())
            .setContentTitle(title)
            .setContentText(body)
            .setSubText(if (locale == "fr") "ESH · MATCH EN DIRECT" else "ESH · مباراة مباشرة")
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(openApp)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(false)
            .build()
        runCatching { NotificationManagerCompat.from(this).notify(tag, tag.hashCode(), notification) }
    }

    companion object {
        const val PREFS = "esh_public_supporters"
        const val ALERTS_KEY = "match_alerts"
        const val LOCALE = "locale"
        private const val CHANNEL = "esh_public_live_matches_v1"

        fun alerts(context: Context): List<PublicAlert> = runCatching {
            val json = JSONArray(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(ALERTS_KEY, "[]"))
            (0 until json.length()).mapNotNull { index -> json.optJSONObject(index)?.let { PublicAlert(it.optString("id"), it.optString("title"), it.optString("body"), it.optLong("time"), it.optString("kind")) } }
                .sortedByDescending { it.time }
        }.getOrDefault(emptyList())

        fun dismiss(context: Context, id: String) {
            val saved = alerts(context).filterNot { it.id == id }
            storeAlerts(context, saved)
        }

        fun registerIfConfigured(context: Context, locale: String) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(LOCALE, locale).apply()
            val firebase = runCatching { FirebaseApp.initializeApp(context) }.getOrNull()
            if (firebase == null) {
                Log.e("ESH-FCM", "Firebase is not initialized; match alerts cannot be registered")
                return
            }
            val messaging = runCatching { FirebaseMessaging.getInstance() }.getOrNull()
            if (messaging == null) {
                Log.e("ESH-FCM", "Firebase Messaging is unavailable")
                return
            }
            messaging.token.addOnSuccessListener { token ->
                registerToken(context.applicationContext, token, locale)
            }.addOnFailureListener { error ->
                Log.e("ESH-FCM", "Could not obtain the FCM registration token", error)
            }
        }

        private fun registerToken(context: Context, token: String, locale: String) {
            thread(name = "esh-public-fcm-register") {
                var lastError: Throwable? = null
                repeat(3) { attempt ->
                    try {
                        PublicApi.registerDevice(token, locale)
                        Log.i("ESH-FCM", "Device token registered for match updates")
                        return@thread
                    } catch (error: Throwable) {
                        lastError = error
                        if (attempt < 2) Thread.sleep(1_000L shl attempt)
                    }
                }
                Log.e("ESH-FCM", "Could not register this device for match updates", lastError)
            }
        }

        private fun saveAlert(context: Context, alert: PublicAlert) {
            val alerts = listOf(alert) + alerts(context).filterNot { it.id == alert.id }
            storeAlerts(context, alerts.take(100))
        }

        private fun storeAlerts(context: Context, alerts: List<PublicAlert>) {
            val json = JSONArray()
            alerts.forEach { json.put(JSONObject().put("id", it.id).put("title", it.title).put("body", it.body).put("time", it.time).put("kind", it.kind)) }
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(ALERTS_KEY, json.toString()).apply()
        }
    }
}
