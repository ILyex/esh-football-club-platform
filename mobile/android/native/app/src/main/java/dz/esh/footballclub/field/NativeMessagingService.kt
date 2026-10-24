package dz.esh.footballclub.field

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.graphics.BitmapFactory
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

class NativeMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).edit().putString(PUSH_TOKEN_KEY, token).apply()
        val session = NativeSessionStore(this).read() ?: return
        val locale = getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).getString("locale", "ar") ?: "ar"
        registerDeviceToken(this, session, token, locale)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // General platform notifications must not be mirrored to the native app.
        // Only app-owned sports and club events are accepted here.
        val section = message.data["section"] ?: return
        if (section !in setOf("matches", "meetings", "training", "updates")) return
        val title = message.notification?.title ?: message.data["title"] ?: "تنبيه · أمل سيدي حسني"
        val body = message.notification?.body ?: message.data["body"].orEmpty()
        val kind = message.data["kind"] ?: when (section) {
            "matches" -> "MATCH_UPDATE"
            "meetings" -> "MEETING"
            "training" -> "TRAINING"
            else -> "NEW_ANNOUNCEMENT"
        }
        val alertId = "push-${message.data["tag"] ?: message.messageId ?: System.currentTimeMillis()}"
        saveAppAlert(applicationContext, NativeAlert(alertId, title, body, false, kind))
        val isFrench = getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).getString("locale", "ar") == "fr"
        val sectionLabel = when (section) {
            "matches" -> if (isFrench) "Matchs" else "المباريات"
            "meetings" -> if (isFrench) "Réunions" else "الاجتماعات"
            "training" -> if (isFrench) "Entraînements" else "التدريبات"
            else -> if (isFrench) "Actualités de l’application" else "تحديثات التطبيق"
        }
        val manager = getSystemService(NotificationManager::class.java)
        val soundsEnabled = getSharedPreferences("esh_native_ui", Context.MODE_PRIVATE).getBoolean("sound_effects", true)
        val channelId = if (soundsEnabled) CHANNEL_ID_SOUND else CHANNEL_ID_SILENT
        val notificationSound = Uri.parse("android.resource://$packageName/${R.raw.sound_notification_pop}")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(NotificationChannel(channelId, "تنبيهات أمل سيدي حسني", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "تنبيهات المباريات والأهداف والاجتماعات والتدريبات"
                setSound(if (soundsEnabled) notificationSound else null, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 180, 80, 180)
                setShowBadge(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
            })
        }
        val stableTag = message.data["tag"]
        val requestCode = stableTag?.hashCode() ?: message.messageId?.hashCode() ?: System.currentTimeMillis().toInt()
        val openApp = PendingIntent.getActivity(this, requestCode, Intent(this, MainActivity::class.java)
            .putExtra("notification_section", section), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val clubLogo = BitmapFactory.decodeResource(resources, R.drawable.esh_logo)
        val notification = NotificationCompat.Builder(this, channelId)
            // Monochrome white ESH crest supplied for Android's status bar slot.
            .setSmallIcon(R.drawable.esh_notification_logo)
            .setLargeIcon(clubLogo)
            .setColor(0xFFDC2626.toInt())
            .setSubText("ESH · $sectionLabel")
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().setBigContentTitle(title).bigText(body).setSummaryText("E SIDI HOSNI"))
            .setContentIntent(openApp)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setShowWhen(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(if (soundsEnabled) NotificationCompat.DEFAULT_VIBRATE else 0)
            .apply { if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O && soundsEnabled) setSound(notificationSound) }
            .build()
        runCatching { NotificationManagerCompat.from(this).notify(stableTag, requestCode, notification) }
    }

    companion object {
        const val PUSH_PREFS = "esh_native_push"
        const val PUSH_TOKEN_KEY = "fcm_token"
        private const val APP_INBOX_KEY = "app_notification_inbox"
        private const val CHANNEL_ID_SOUND = "esh_club_updates_sound_v3"
        private const val CHANNEL_ID_SILENT = "esh_club_updates_silent_v3"

        fun savedAppAlerts(context: Context): List<NativeAlert> = runCatching {
            val alerts = JSONArray(context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).getString(APP_INBOX_KEY, "[]"))
            (0 until alerts.length()).mapNotNull { index ->
                val item = alerts.optJSONObject(index) ?: return@mapNotNull null
                NativeAlert(item.optString("id"), item.optString("title"), item.optString("message").takeIf(String::isNotBlank), false, item.optString("kind", "MATCH_UPDATE"))
            }
        }.getOrDefault(emptyList())

        fun dismissAppAlert(context: Context, id: String) {
            val prefs = context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE)
            val existing = runCatching { JSONArray(prefs.getString(APP_INBOX_KEY, "[]")) }.getOrDefault(JSONArray())
            val next = JSONArray()
            for (index in 0 until existing.length()) {
                val item = existing.optJSONObject(index) ?: continue
                if (item.optString("id") != id) next.put(item)
            }
            prefs.edit().putString(APP_INBOX_KEY, next.toString()).apply()
        }

        fun clearAppAlerts(context: Context) {
            context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).edit().remove(APP_INBOX_KEY).apply()
        }

        private fun saveAppAlert(context: Context, alert: NativeAlert) {
            val prefs = context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE)
            val existing = runCatching { JSONArray(prefs.getString(APP_INBOX_KEY, "[]")) }.getOrDefault(JSONArray())
            val next = JSONArray()
            for (index in 0 until existing.length()) {
                val item = existing.optJSONObject(index) ?: continue
                if (item.optString("id") != alert.id) next.put(item)
            }
            next.put(JSONObject().put("id", alert.id).put("title", alert.title).put("message", alert.message).put("kind", alert.kind))
            val compact = JSONArray()
            val first = (next.length() - 100).coerceAtLeast(0)
            for (index in first until next.length()) compact.put(next.getJSONObject(index))
            prefs.edit().putString(APP_INBOX_KEY, compact.toString()).apply()
        }

        private fun registerDeviceToken(context: Context, session: String, token: String, locale: String) {
            thread(name = "esh-register-fcm") {
                repeat(4) { attempt ->
                    val result = runCatching { NativeApi.registerPush(session, token, locale) }
                    if (result.isSuccess) return@thread
                    if (attempt < 3) Thread.sleep(1_000L * (1L shl attempt))
                }
                android.util.Log.w("EshNativePush", "Device registration failed after retries; it will retry when FCM refreshes the token or the user signs in again.")
            }
        }

        fun registerIfConfigured(context: Context, session: String, locale: String): Boolean {
            runCatching { FirebaseApp.initializeApp(context) }.getOrNull() ?: return false
            val messaging = runCatching { FirebaseMessaging.getInstance() }.getOrNull() ?: return false
            context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).edit().putString("locale", locale).apply()
            messaging.token.addOnSuccessListener { token ->
                context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).edit().putString(PUSH_TOKEN_KEY, token).putString("locale", locale).apply()
                registerDeviceToken(context, session, token, locale)
            }
            return true
        }

        fun updateLocale(context: Context, session: String, locale: String) {
            context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).edit().putString("locale", locale).apply()
            val token = context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).getString(PUSH_TOKEN_KEY, null) ?: return
            registerDeviceToken(context, session, token, locale)
        }

        fun unregister(context: Context, session: String) {
            val token = context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).getString(PUSH_TOKEN_KEY, null) ?: return
            thread(name = "esh-unregister-fcm") { runCatching { NativeApi.unregisterPush(session, token) } }
        }
    }
}
