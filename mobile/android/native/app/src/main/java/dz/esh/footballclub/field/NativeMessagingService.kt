package dz.esh.footballclub.field

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
import kotlin.concurrent.thread

class NativeMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).edit().putString(PUSH_TOKEN_KEY, token).apply()
        val session = NativeSessionStore(this).read() ?: return
        val locale = getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).getString("locale", "ar") ?: "ar"
        thread(name = "esh-register-fcm") { runCatching { NativeApi.registerPush(session, token, locale) } }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title ?: message.data["title"] ?: "تنبيه · أمل سيدي حسني"
        val body = message.notification?.body ?: message.data["body"].orEmpty()
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "تنبيهات النادي", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "إشعارات اجتماعات وإدارة النادي"
            })
        }
        val openApp = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(openApp)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        runCatching { NotificationManagerCompat.from(this).notify(message.messageId?.hashCode() ?: System.currentTimeMillis().toInt(), notification) }
    }

    companion object {
        const val PUSH_PREFS = "esh_native_push"
        const val PUSH_TOKEN_KEY = "fcm_token"
        private const val CHANNEL_ID = "esh_admin_alerts"

        fun registerIfConfigured(context: Context, session: String, locale: String): Boolean {
            runCatching { FirebaseApp.initializeApp(context) }.getOrNull() ?: return false
            val messaging = runCatching { FirebaseMessaging.getInstance() }.getOrNull() ?: return false
            context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).edit().putString("locale", locale).apply()
            messaging.token.addOnSuccessListener { token -> thread(name = "esh-register-fcm") { runCatching { NativeApi.registerPush(session, token, locale) } } }
            return true
        }

        fun updateLocale(context: Context, session: String, locale: String) {
            context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).edit().putString("locale", locale).apply()
            val token = context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).getString(PUSH_TOKEN_KEY, null) ?: return
            thread(name = "esh-register-fcm") { runCatching { NativeApi.registerPush(session, token, locale) } }
        }

        fun unregister(context: Context, session: String) {
            val token = context.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE).getString(PUSH_TOKEN_KEY, null) ?: return
            thread(name = "esh-unregister-fcm") { runCatching { NativeApi.unregisterPush(session, token) } }
        }
    }
}
