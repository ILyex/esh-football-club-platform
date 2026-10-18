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
import kotlin.concurrent.thread

class NativeMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).edit().putString(PUSH_TOKEN_KEY, token).apply()
        val session = NativeSessionStore(this).read() ?: return
        val locale = getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).getString("locale", "ar") ?: "ar"
        registerDeviceToken(this, session, token, locale)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // General platform announcements must not be mirrored to the native app.
        // Only match and meeting events are in scope for native notifications.
        val section = message.data["section"] ?: return
        if (section != "matches" && section != "meetings") return
        val title = message.notification?.title ?: message.data["title"] ?: "تنبيه · أمل سيدي حسني"
        val body = message.notification?.body ?: message.data["body"].orEmpty()
        val manager = getSystemService(NotificationManager::class.java)
        val soundsEnabled = getSharedPreferences("esh_native_ui", Context.MODE_PRIVATE).getBoolean("sound_effects", true)
        val channelId = if (soundsEnabled) CHANNEL_ID_SOUND else CHANNEL_ID_SILENT
        val notificationSound = Uri.parse("android.resource://$packageName/${R.raw.sound_notification_pop}")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(NotificationChannel(channelId, "تنبيهات أمل سيدي حسني", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "تنبيهات المباريات والاجتماعات المهمة"
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
            .setSmallIcon(R.drawable.ic_notification)
            .setLargeIcon(clubLogo)
            .setColor(0xFFDC2626.toInt())
            .setSubText("E SIDI HOSNI")
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
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
        private const val CHANNEL_ID_SOUND = "esh_club_updates_sound_v3"
        private const val CHANNEL_ID_SILENT = "esh_club_updates_silent_v3"

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
