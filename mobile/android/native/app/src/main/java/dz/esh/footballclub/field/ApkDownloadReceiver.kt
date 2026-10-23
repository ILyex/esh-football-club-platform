package dz.esh.footballclub.field

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.app.DownloadManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import java.security.MessageDigest

class ApkDownloadReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
        val downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (downloadId < 0 || prefs.getLong(PENDING_DOWNLOAD_ID, -1L) != downloadId) return

        val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val query = DownloadManager.Query().setFilterById(downloadId)
        manager.query(query)?.use { cursor ->
            if (!cursor.moveToFirst()) return
            val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            // Ignore forged or early broadcasts while DownloadManager is still
            // working. Only a terminal failure may clear the persisted job.
            if (status != DownloadManager.STATUS_SUCCESSFUL && status != DownloadManager.STATUS_FAILED) return
            if (status == DownloadManager.STATUS_FAILED) {
                prefs.edit()
                    .remove(PENDING_DOWNLOAD_ID).remove(PENDING_SHA256).remove(PENDING_TAG).remove(SUPPRESS_TAG)
                    .putBoolean(DOWNLOAD_ACTIVE, false).putBoolean(DOWNLOAD_FAILED, true).apply()
                return
            }
        }

        val apkUri = manager.getUriForDownloadedFile(downloadId) ?: run {
            prefs.edit()
                .remove(PENDING_DOWNLOAD_ID).remove(PENDING_SHA256).remove(PENDING_TAG).remove(SUPPRESS_TAG)
                .putBoolean(DOWNLOAD_ACTIVE, false).putBoolean(DOWNLOAD_FAILED, true).apply()
            return
        }
        val expectedSha256 = prefs.getString(PENDING_SHA256, null)
        if (expectedSha256 != null) {
            val actualSha256 = runCatching {
                context.contentResolver.openInputStream(apkUri)!!.use { stream ->
                    val digest = MessageDigest.getInstance("SHA-256")
                    val buffer = ByteArray(16 * 1024)
                    while (true) {
                        val count = stream.read(buffer)
                        if (count < 0) break
                        digest.update(buffer, 0, count)
                    }
                    digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
                }
            }.getOrNull()
            if (!expectedSha256.equals(actualSha256, ignoreCase = true)) {
                manager.remove(downloadId)
                prefs.edit()
                    .remove(PENDING_DOWNLOAD_ID).remove(PENDING_SHA256).remove(PENDING_TAG).remove(SUPPRESS_TAG)
                    .putBoolean(DOWNLOAD_ACTIVE, false).putBoolean(DOWNLOAD_FAILED, true).apply()
                return
            }
        }
        prefs.edit().remove(PENDING_DOWNLOAD_ID).remove(PENDING_SHA256)
            .putString(PENDING_URI, apkUri.toString()).putBoolean(DOWNLOAD_ACTIVE, false).putBoolean(DOWNLOAD_FAILED, false).apply()
        // Foreground updates are completed by MainActivity's in-app progress flow.
        // When the app is not open, keep the notification fallback so the user can
        // resume the installation later.
        if (!MainActivity.isForeground) postInstallNotification(context, apkUri, downloadId)
    }

    private fun requestInstall(context: Context, prefs: android.content.SharedPreferences, apkUri: Uri) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
            val settings = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            runCatching { context.startActivity(settings) }
                .onFailure { postInstallNotification(context, apkUri, apkUri.hashCode().toLong()) }
            return
        }
        val install = Intent(Intent.ACTION_VIEW).setDataAndType(apkUri, APK_MIME)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(install) }
            .onFailure { postInstallNotification(context, apkUri, apkUri.hashCode().toLong()) }
    }

    private fun postInstallNotification(context: Context, apkUri: Uri, notificationId: Long) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(INSTALL_CHANNEL, "تحديثات التطبيق", NotificationManager.IMPORTANCE_HIGH)
            )
        }
        val openInstaller = Intent(context, MainActivity::class.java)
            .setAction(ACTION_INSTALL_UPDATE)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            .setData(apkUri)
        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId.toInt(),
            openInstaller,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(context, INSTALL_CHANNEL)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(context)
        })
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle("التحديث جاهز للتثبيت")
            .setContentText("اضغط هنا لفتح شاشة تثبيت التطبيق")
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_STATUS)
            .setPriority(Notification.PRIORITY_HIGH)
            .build()
        runCatching { manager.notify(INSTALL_NOTIFICATION_ID, notification) }
    }

    companion object {
        const val PREFS = "esh_native_updater"
        const val PENDING_DOWNLOAD_ID = "pending_download_id"
        const val PENDING_SHA256 = "pending_sha256"
        const val PENDING_TAG = "pending_tag"
        const val PENDING_URI = "pending_install_uri"
        const val DOWNLOAD_ACTIVE = "download_active"
        const val SUPPRESS_TAG = "suppress_update_tag"
        const val DISMISSED_TAG = "dismissed_update_tag"
        const val DOWNLOAD_FAILED = "download_failed"
        const val APK_MIME = "application/vnd.android.package-archive"
        const val ACTION_INSTALL_UPDATE = "dz.esh.footballclub.field.INSTALL_UPDATE"
        private const val INSTALL_CHANNEL = "app_update_install"
        private const val INSTALL_NOTIFICATION_ID = 6302
    }
}
