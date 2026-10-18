package dz.esh.footballclub.field

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.app.DownloadManager
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
            if (status != DownloadManager.STATUS_SUCCESSFUL) {
                prefs.edit().remove(PENDING_DOWNLOAD_ID).remove(PENDING_SHA256).putBoolean(DOWNLOAD_FAILED, true).apply()
                return
            }
        }

        val apkUri = manager.getUriForDownloadedFile(downloadId) ?: run {
            prefs.edit().remove(PENDING_DOWNLOAD_ID).putBoolean(DOWNLOAD_FAILED, true).apply()
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
                prefs.edit().remove(PENDING_DOWNLOAD_ID).remove(PENDING_SHA256).putBoolean(DOWNLOAD_FAILED, true).apply()
                return
            }
        }
        prefs.edit().remove(PENDING_DOWNLOAD_ID).remove(PENDING_SHA256).putBoolean(DOWNLOAD_FAILED, false).apply()
        requestInstall(context, prefs, apkUri)
    }

    private fun requestInstall(context: Context, prefs: android.content.SharedPreferences, apkUri: Uri) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
            prefs.edit().putString(PENDING_URI, apkUri.toString()).apply()
            val settings = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(settings)
            return
        }
        val install = Intent(Intent.ACTION_VIEW).setDataAndType(apkUri, APK_MIME)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(install)
    }

    companion object {
        const val PREFS = "esh_native_updater"
        const val PENDING_DOWNLOAD_ID = "pending_download_id"
        const val PENDING_SHA256 = "pending_sha256"
        const val PENDING_URI = "pending_install_uri"
        const val DOWNLOAD_FAILED = "download_failed"
        const val APK_MIME = "application/vnd.android.package-archive"
    }
}
