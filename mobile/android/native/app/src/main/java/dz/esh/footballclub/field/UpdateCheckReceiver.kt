package dz.esh.footballclub.field

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import kotlin.concurrent.thread

/** Checks the public release manifest while the app is closed and notifies once per release. */
class UpdateCheckReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        schedule(context)
        val pending = goAsync()
        thread(name = "esh-update-check") {
            try {
                if (intent?.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
                    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(NOTIFIED_TAG).apply()
                }
                val release = runCatching { NativeApi.latestRelease() }.getOrNull() ?: return@thread
                val installed = runCatching {
                    context.packageManager.getPackageInfo(context.packageName, 0).versionName.orEmpty()
                }.getOrDefault("")
                if (!isNativeUpdateAvailable(release.tag, installed)) return@thread
                val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                if (prefs.getString(NOTIFIED_TAG, null) == release.tag) return@thread
                postNotification(context, release.tag)
                prefs.edit().putString(NOTIFIED_TAG, release.tag).apply()
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        private const val PREFS = "esh_native_update_checks"
        private const val NOTIFIED_TAG = "notified_release"
        private const val ACTION_CHECK = "dz.esh.footballclub.field.CHECK_UPDATE"
        private const val CHANNEL = "app_update_available"
        private const val NOTIFICATION_ID = 6303
        private const val INTERVAL = 24L * 60L * 60L * 1000L

        fun schedule(context: Context) {
            val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, UpdateCheckReceiver::class.java).setAction(ACTION_CHECK)
            val pending = PendingIntent.getBroadcast(
                context, 6303, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val first = System.currentTimeMillis() + 15L * 60L * 1000L
            alarm.setInexactRepeating(AlarmManager.RTC_WAKEUP, first, INTERVAL, pending)
        }

        private fun postNotification(context: Context, tag: String) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                manager.createNotificationChannel(
                    NotificationChannel(CHANNEL, "تحديثات التطبيق", NotificationManager.IMPORTANCE_DEFAULT)
                )
            }
            val openApp = PendingIntent.getActivity(
                context, NOTIFICATION_ID,
                Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Notification.Builder(context, CHANNEL)
            } else {
                @Suppress("DEPRECATION") Notification.Builder(context)
            }
            val notification = builder
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle("يتوفر تحديث جديد لتطبيق ESH")
                .setContentText("الإصدار $tag جاهز للتنزيل من داخل التطبيق")
                .setContentIntent(openApp)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_RECOMMENDATION)
                .build()
            runCatching { manager.notify(NOTIFICATION_ID, notification) }
        }
    }
}
