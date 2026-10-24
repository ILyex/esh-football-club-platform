package dz.esh.footballclub.publicapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
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
        thread(name = "esh-public-fcm-register") { runCatching { PublicApi.registerDevice(token, locale) } }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        if (message.data["section"] != "matches") return
        val title = message.data["title"] ?: return
        val body = message.data["body"].orEmpty()
        val tag = message.data["tag"] ?: message.messageId ?: System.currentTimeMillis().toString()
        val kind = message.data["kind"] ?: "MATCH_UPDATE"
        val id = "public-$tag"
        saveAlert(applicationContext, PublicAlert(id, title, body, System.currentTimeMillis(), kind))
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(NotificationChannel(CHANNEL, "أخبار المباريات", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "أهداف وتحديثات المباريات المباشرة"
                enableVibration(true)
                setShowBadge(true)
            })
        }
        val openApp = PendingIntent.getActivity(this, tag.hashCode(), Intent(this, MainActivity::class.java).putExtra("open_tab", "alerts"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification_public)
            .setLargeIcon(android.graphics.BitmapFactory.decodeResource(resources, R.drawable.esh_logo))
            .setColor(0xFFD60A35.toInt())
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(openApp)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
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
            if (runCatching { FirebaseApp.initializeApp(context) }.getOrNull() == null) return
            runCatching { FirebaseMessaging.getInstance() }.getOrNull()?.token?.addOnSuccessListener { token ->
                thread(name = "esh-public-fcm-register") { runCatching { PublicApi.registerDevice(token, locale) } }
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
