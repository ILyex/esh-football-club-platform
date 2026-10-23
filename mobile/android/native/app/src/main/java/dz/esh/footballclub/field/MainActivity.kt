package dz.esh.footballclub.field

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.content.pm.PackageManager
import android.app.DownloadManager
import android.os.Environment
import android.os.Build
import android.os.Bundle
import java.security.MessageDigest
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.res.painterResource
import androidx.compose.foundation.Image
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.graphics.asImageBitmap
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import com.airbnb.lottie.compose.LottieAnimation
import com.airbnb.lottie.compose.LottieCompositionSpec
import com.airbnb.lottie.compose.animateLottieCompositionAsState
import com.airbnb.lottie.compose.rememberLottieComposition
import androidx.compose.material3.Button
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.Typography
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.zIndex
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.input.KeyboardType
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.produceState
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.ui.graphics.ImageBitmap
import android.graphics.BitmapFactory
import android.graphics.Bitmap
import android.util.Base64
import android.content.Context
import android.content.pm.PackageInstaller
import android.app.PendingIntent
import android.app.Activity
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import java.util.Calendar
import androidx.core.view.WindowInsetsControllerCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Job
import java.io.File
import java.io.ByteArrayInputStream
import java.net.URL

private var nativeThemeIsLight by mutableStateOf(false)
private val Ink get() = if (nativeThemeIsLight) Color(0xFFF2F3F5) else Color(0xFF111315)
private val Panel get() = if (nativeThemeIsLight) Color(0xFFFFFFFF) else Color(0xFF1A1D20)
private val Glass get() = if (nativeThemeIsLight) Color(0xFFF8F9FA) else Color(0xFF22262A)
private val Red = Color(0xFFDC2626)
private val Mint get() = if (nativeThemeIsLight) Color(0xFF008B68) else Color(0xFF20D7A0)
private val AppText get() = if (nativeThemeIsLight) Color(0xFF20242A) else Color(0xFFF5F6F7)
private val Muted get() = if (nativeThemeIsLight) Color(0xFF66717D) else Color(0xFF9AA1A9)
private val GlassBorder get() = if (nativeThemeIsLight) Color(0xFFD9DEE4) else Color.White.copy(alpha = .09f)
private val RedGlow get() = Red.copy(alpha = if (nativeThemeIsLight) .10f else .20f)
private val MintGlow get() = Mint.copy(alpha = if (nativeThemeIsLight) .09f else .12f)
private val CardStart get() = if (nativeThemeIsLight) Color(0xFFFFFFFF) else Color(0xFF202328)
private val CardEnd get() = if (nativeThemeIsLight) Color(0xFFFFFFFF) else Color(0xFF202328)
private val CairoFamily = FontFamily(Font(R.font.cairo_variable, FontWeight.Normal))
private fun L(locale: String, ar: String, fr: String): String = if (locale == "fr") fr else ar

class MainActivity : ComponentActivity() {
    companion object {
        @Volatile
        var isForeground: Boolean = false
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        NativeApi.initializeCache(applicationContext)
        UpdateCheckReceiver.schedule(applicationContext)
        window.statusBarColor = android.graphics.Color.rgb(9, 11, 14)
        window.navigationBarColor = android.graphics.Color.rgb(9, 11, 14)
        val baseTypography = Typography()
        val cairoTypography = baseTypography.copy(
            displayLarge = baseTypography.displayLarge.copy(fontFamily = CairoFamily), displayMedium = baseTypography.displayMedium.copy(fontFamily = CairoFamily), displaySmall = baseTypography.displaySmall.copy(fontFamily = CairoFamily),
            headlineLarge = baseTypography.headlineLarge.copy(fontFamily = CairoFamily), headlineMedium = baseTypography.headlineMedium.copy(fontFamily = CairoFamily), headlineSmall = baseTypography.headlineSmall.copy(fontFamily = CairoFamily),
            titleLarge = baseTypography.titleLarge.copy(fontFamily = CairoFamily), titleMedium = baseTypography.titleMedium.copy(fontFamily = CairoFamily), titleSmall = baseTypography.titleSmall.copy(fontFamily = CairoFamily),
            bodyLarge = baseTypography.bodyLarge.copy(fontFamily = CairoFamily), bodyMedium = baseTypography.bodyMedium.copy(fontFamily = CairoFamily), bodySmall = baseTypography.bodySmall.copy(fontFamily = CairoFamily),
            labelLarge = baseTypography.labelLarge.copy(fontFamily = CairoFamily), labelMedium = baseTypography.labelMedium.copy(fontFamily = CairoFamily), labelSmall = baseTypography.labelSmall.copy(fontFamily = CairoFamily)
        )
        setContent { MaterialTheme(typography = cairoTypography) { MatchdayApp() } }
        handleInstallIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleInstallIntent(intent)
    }

    private fun handleInstallIntent(intent: Intent?) {
        if (intent?.action != ApkDownloadReceiver.ACTION_INSTALL_UPDATE) return
        val uri = intent.data ?: return
        intent.action = null
        installDownloadedApkUri(this, uri)
    }

    override fun onResume() {
        super.onResume()
        isForeground = true
    }

    override fun onPause() {
        isForeground = false
        super.onPause()
    }
}

private fun installDownloadedApk(context: Context, apkFile: File): Boolean {
    // Commit through the system PackageInstaller session. Opening the APK from
    // the Activity directly can kill the Activity during package replacement and
    // some OEMs report that normal lifecycle transition as an app crash.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
        val settings = Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return runCatching { context.startActivity(settings); false }.getOrDefault(false)
    }
    if (!apkFile.isFile || apkFile.length() <= 0L) return false
    return runCatching {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(context.packageName)
            setSize(apkFile.length())
        }
        val sessionId = installer.createSession(params)
        val session = installer.openSession(sessionId)
        try {
            apkFile.inputStream().use { input ->
                session.openWrite("base.apk", 0L, apkFile.length()).use { output ->
                    input.copyTo(output)
                    session.fsync(output)
                }
            }
            val resultIntent = Intent(context, ApkInstallReceiver::class.java)
                .setAction(ApkInstallReceiver.ACTION_INSTALL_RESULT)
                .putExtra(PackageInstaller.EXTRA_SESSION_ID, sessionId)
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
            val callback = PendingIntent.getBroadcast(context, sessionId, resultIntent, flags)
            session.commit(callback.intentSender)
        } finally {
            session.close()
        }
        true
    }.getOrElse { false }
}

private fun installDownloadedApkUri(context: Context, apkUri: Uri): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
        // Keep the verified file while the user grants Android's install
        // permission. Returning to the app can then continue without another
        // download or a misleading "download failed" message.
        context.getSharedPreferences(ApkDownloadReceiver.PREFS, Context.MODE_PRIVATE).edit()
            .putString(ApkDownloadReceiver.PENDING_URI, apkUri.toString())
            .apply()
        val settings = Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return runCatching { context.startActivity(settings); true }.getOrDefault(false)
    }
    // Let Android's trusted package installer own the replacement flow. A
    // PackageInstaller session committed from the current Activity can tear
    // down this process while Compose is still rendering and is reported as
    // an app crash by several OEM builds. The system installer handles the
    // confirmation and process replacement safely from this content URI.
    return runCatching {
        val install = Intent(Intent.ACTION_VIEW)
            .setDataAndType(apkUri, ApkDownloadReceiver.APK_MIME)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            .apply { clipData = android.content.ClipData.newRawUri("ESH update", apkUri) }
        context.startActivity(install)
        true
    }.getOrElse { false }
}

private fun enqueueBackgroundUpdate(context: Context, release: NativeRelease): Long {
    return runCatching {
    require(release.apkUrl.startsWith("https://")) { "invalid_update_url" }
    val fileName = "esh-update-${release.tag.replace(Regex("[^A-Za-z0-9._-]"), "_")}.apk"
    val request = DownloadManager.Request(Uri.parse(release.apkUrl))
        .setTitle("تحديث تطبيق ESH")
        .setDescription("جارٍ تنزيل التحديث في الخلفية")
        .setMimeType(ApkDownloadReceiver.APK_MIME)
        .addRequestHeader("User-Agent", "ESH-Android-Updater")
        .addRequestHeader("Accept", ApkDownloadReceiver.APK_MIME)
        .addRequestHeader("Cache-Control", "no-cache")
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_HIDDEN)
        .setAllowedOverMetered(true)
        .setAllowedOverRoaming(false)
        .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, fileName)
    val id = (context.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager)?.enqueue(request) ?: error("download_manager_unavailable")
    context.getSharedPreferences(ApkDownloadReceiver.PREFS, Context.MODE_PRIVATE).edit()
        .putLong(ApkDownloadReceiver.PENDING_DOWNLOAD_ID, id)
        .putString(ApkDownloadReceiver.PENDING_SHA256, release.sha256)
        .putString(ApkDownloadReceiver.PENDING_TAG, release.tag)
        .putString(ApkDownloadReceiver.SUPPRESS_TAG, release.tag)
        .putBoolean(ApkDownloadReceiver.DOWNLOAD_ACTIVE, true)
        .apply()
    id
    }.getOrElse { -1L }
}

/**
 * Some OEM builds disable or misconfigure the system DownloadManager. Keep an
 * in-app fallback so an update can still be downloaded and verified instead
 * of showing the misleading "background download" error.
 */
private suspend fun downloadUpdateDirect(
    context: Context,
    release: NativeRelease,
    onProgress: suspend (Int) -> Unit
): File {
    val destination = File(context.cacheDir, "updates/esh-update-${release.tag}.apk")
    NativeApi.downloadApk(release.apkUrl, destination, release.sha256, onProgress)
    return destination
}

private object IconlyIcons {
    val Home = R.drawable.iconly_home
    val Travel = R.drawable.iconly_airplane
    val Match = R.drawable.ic_match_ball
    val MatchFilled = R.drawable.ic_match_ball_filled
    val Meeting = R.drawable.iconly_users
    val MeetingFilled = R.drawable.iconly_users_filled
    val People = R.drawable.iconly_users
    val Calendar = R.drawable.iconly_calendar
    val Notification = R.drawable.iconly_notification
    val Logout = R.drawable.iconly_logout
    val More = R.drawable.iconly_more_circle
    val Theme = R.drawable.ic_contrast_mode
    val Sun = R.drawable.iconly_sun
    val Moon = R.drawable.iconly_moon
    val Refresh = R.drawable.iconly_swap
    val Update = R.drawable.iconly_download
    val Language = R.drawable.iconly_language
    // A football communicates goals and xG directly; the old ticket icon was
    // misleading in the match and player statistics cards.
    val GoalBall = R.drawable.ic_match_ball
    val OpponentShield = R.drawable.iconly_shield_done
    val ArrowLeft = R.drawable.iconly_arrow_left
    val ArrowRight = R.drawable.iconly_arrow_right
    val ArrowDown = R.drawable.iconly_arrow_down
    val Document = R.drawable.iconly_document
    val Paper = R.drawable.iconly_paper
    val Plus = R.drawable.iconly_plus
    val Close = R.drawable.iconly_close_square
    val Check = R.drawable.iconly_tick_square
    val Search = R.drawable.iconly_search
    val Setting = R.drawable.iconly_setting
    val Hide = R.drawable.iconly_hide
    val Show = R.drawable.iconly_eye
    val Mail = R.drawable.iconly_mail
    val Lock = R.drawable.iconly_lock
    val Download = R.drawable.iconly_download
    val Wallet = R.drawable.iconly_wallet
    val Camera = R.drawable.iconly_camera
    val Activity = R.drawable.iconly_activity
    val Star = R.drawable.iconly_star
}

private enum class Section(val icon: Int, val selectedIcon: Int) {
    HOME(IconlyIcons.Home, R.drawable.iconly_home_filled),
    MATCHES(IconlyIcons.Match, IconlyIcons.Match),
    CALENDAR(IconlyIcons.Calendar, IconlyIcons.Calendar),
    MEETINGS(IconlyIcons.Meeting, IconlyIcons.MeetingFilled),
    COMPETITIONS(IconlyIcons.Star, IconlyIcons.Star),
    PLAYER_STATS(IconlyIcons.Activity, IconlyIcons.Activity),
    ALERTS(IconlyIcons.Notification, IconlyIcons.Notification)
}
private fun Section.title(locale: String) = when (this) { Section.HOME -> L(locale, "الرئيسية", "Accueil"); Section.MATCHES -> L(locale, "المباريات", "Matchs"); Section.CALENDAR -> L(locale, "الرزنامة", "Calendrier"); Section.MEETINGS -> L(locale, "الاجتماعات", "Réunions"); Section.COMPETITIONS -> L(locale, "المسابقات", "Compétitions"); Section.PLAYER_STATS -> L(locale, "إحصائيات اللاعبين", "Stats joueurs"); Section.ALERTS -> L(locale, "الإشعارات", "Notifications") }
private fun Section.subtitle(locale: String) = when (this) { Section.HOME -> L(locale, "ابدأ العمل", "Commencez votre travail"); Section.MATCHES -> L(locale, "إدارة المباراة لحظة بلحظة", "Gestion des matchs en direct"); Section.CALENDAR -> L(locale, "كل ما هو قادم للنادي في مكان واحد", "Tous les rendez-vous à venir du club"); Section.MEETINGS -> L(locale, "مواعيد وقرارات النادي", "Calendrier et décisions du club"); Section.COMPETITIONS -> L(locale, "الترتيب الرسمي المتزامن مع المنصة", "Classements officiels synchronisés"); Section.PLAYER_STATS -> L(locale, "أداء لاعبي فئتك متزامن مع المنصة", "Performances synchronisées avec la plateforme"); Section.ALERTS -> L(locale, "إشعارات الإدارة على الهاتف", "Alertes administratives sur le téléphone") }

@Composable
private fun MatchdayApp() {
    val context = LocalContext.current
    val sessionStore = remember { NativeSessionStore(context) }
    val scope = rememberCoroutineScope()
    var token by remember { mutableStateOf(sessionStore.read()) }
    val preferences = remember { context.getSharedPreferences("esh_native_ui", android.content.Context.MODE_PRIVATE) }
    var dismissedAlertIds by remember { mutableStateOf(preferences.getStringSet("dismissed_alert_ids", emptySet()).orEmpty()) }
    fun visiblePayload(payload: NativeData): NativeData = payload.copy(alerts = payload.alerts.filterNot { it.id in dismissedAlertIds })
    // SharedPreferences contains serialized dashboard data. Parsing it can be
    // expensive on older phones, so defer the disk read and JSON decoding to IO.
    var user by remember { mutableStateOf<NativeUser?>(null) }
    var data by remember { mutableStateOf<NativeData?>(null) }
    var matchDetailsLoaded by remember(token) { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var connectionError by remember { mutableStateOf<String?>(null) }
    var playerStats by remember(token) { mutableStateOf<NativePlayerStats?>(null) }
    var playerStatsLoading by remember { mutableStateOf(false) }
    var playerStatsError by remember { mutableStateOf<String?>(null) }
    var section by remember { mutableStateOf(Section.HOME) }
    var notificationRoutePending by remember { mutableStateOf((context as? Activity)?.intent?.getStringExtra("notification_section") in setOf("matches", "meetings")) }
    var locale by remember { mutableStateOf(preferences.getString("locale", "ar") ?: "ar") }
    var lightMode by remember {
        val saved = preferences.getBoolean("light_mode", false)
        nativeThemeIsLight = saved
        mutableStateOf(saved)
    }
    var soundEffectsEnabled by remember { mutableStateOf(preferences.getBoolean("sound_effects", true)) }
    LaunchedEffect(Unit) { NativeSoundEffects.initialize(context) }
    LaunchedEffect(token, notificationRoutePending) {
        if (notificationRoutePending && token != null) {
            section = Section.ALERTS
            notificationRoutePending = false
            (context as? Activity)?.intent?.removeExtra("notification_section")
        }
    }
    var refreshNonce by remember { mutableIntStateOf(0) }
    var updateCheckNonce by remember { mutableIntStateOf(0) }
    var firstResumeHandled by remember { mutableStateOf(false) }
    // "Later" suppresses the automatic update prompt for this app session.
    // The flag is intentionally in Compose state, so it resets when the app
    // process is launched again and the next entry can check for updates.
    var updateSnoozedThisSession by remember { mutableStateOf(false) }
    var updateNotice by remember { mutableStateOf<String?>(null) }
    var updateRelease by remember { mutableStateOf<NativeRelease?>(null) }
    var checkingUpdate by remember { mutableStateOf(false) }
    var updateDownloading by remember { mutableStateOf(false) }
    var updateProgress by remember { mutableIntStateOf(0) }
    var updateDownloadJob by remember { mutableStateOf<Job?>(null) }
    var updateFile by remember { mutableStateOf<File?>(null) }
    var composerType by remember { mutableStateOf<String?>(null) }
    var createError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(token, locale) {
        val cachedLocale = locale
        val activeToken = token
        if (data == null) {
            val cached = withContext(Dispatchers.IO) {
                NativeApi.cachedData(context, cachedLocale)?.let(::visiblePayload)
            }
            if (token == activeToken && locale == cachedLocale && data == null && cached != null) {
                data = cached
                user = cached.user.takeIf { it.id.isNotBlank() } ?: user
            }
        }
        if (activeToken != null && playerStats == null) {
            val cachedStats = withContext(Dispatchers.IO) { NativeApi.cachedPlayerStats(activeToken) }
            if (token == activeToken && playerStats == null && cachedStats != null) playerStats = cachedStats
        }
    }

    fun toggleTheme() {
        val next = !lightMode
        nativeThemeIsLight = next
        lightMode = next
        preferences.edit().putBoolean("light_mode", next).apply()
    }

    fun toggleSoundEffects() {
        val next = !soundEffectsEnabled
        soundEffectsEnabled = next
        preferences.edit().putBoolean("sound_effects", next).apply()
    }

    fun switchLocale() {
        val next = if (locale == "ar") "fr" else "ar"
        locale = next
        matchDetailsLoaded = section == Section.MATCHES
        preferences.edit().putString("locale", next).apply()
        val activeToken = token ?: return
        NativeMessagingService.updateLocale(context, activeToken, next)
        scope.launch {
            val result = runCatching { withContext(Dispatchers.IO) { NativeApi.data(activeToken, next, summary = section != Section.MATCHES) } }
            if (token != activeToken || locale != next) return@launch
            result.onSuccess { payload ->
                user = payload.user.takeIf { it.id.isNotBlank() } ?: user
                data = visiblePayload(payload)
                matchDetailsLoaded = section == Section.MATCHES
                connectionError = null
            }.onFailure { error ->
                if (error is NativeSessionExpired) {
                    sessionStore.clear()
                    NativeApi.clearCachedData(context)
                    token = null
                    user = null
                    data = null
                    playerStats = null
                    connectionError = L(locale, "انتهت صلاحية الجلسة. سجّل الدخول مجددًا.", "Session expirée. Reconnectez-vous.")
                } else {
                    connectionError = L(locale, "تعذر تحديث اللغة من الخادم؛ بقيت جلستك محفوظة.", "Impossible d’actualiser la langue depuis le serveur ; votre session est conservée.")
                }
            }
        }
    }

    fun checkForUpdate() {
        if (checkingUpdate) return
        // A manual check from Settings is always allowed, even after the user
        // dismissed the automatic prompt with "Later".
        updateSnoozedThisSession = false
        scope.launch {
            checkingUpdate = true
            val releaseCheck = withContext(Dispatchers.IO) { runCatching { NativeApi.latestRelease() } }
            checkingUpdate = false
            val release = releaseCheck.getOrNull()
            when {
                releaseCheck.exceptionOrNull() is NoPublicNativeRelease -> updateNotice = L(locale, "لا يتوفر إصدار تحديث عام يمكن للتطبيق الوصول إليه حاليًا.", "Aucune version publique de mise à jour n’est accessible pour le moment.")
                releaseCheck.isFailure -> updateNotice = L(locale, "تعذر الاتصال بمصدر التحديث. تحقق من الإنترنت وحاول لاحقًا.", "Impossible de joindre la source de mise à jour. Vérifiez votre connexion et réessayez plus tard.")
                release == null -> updateNotice = L(locale, "لا يتوفر إصدار تحديث عام يمكن للتطبيق الوصول إليه حاليًا.", "Aucune version publique de mise à jour n’est accessible pour le moment.")
                isNativeUpdateAvailable(release.tag, context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "") -> updateRelease = release
                else -> updateNotice = L(locale, "التطبيق محدّث بالفعل.", "L’application est déjà à jour.")
            }
        }
    }

    LaunchedEffect(updateCheckNonce) {
        if (updateSnoozedThisSession) return@LaunchedEffect
        val updaterPrefs = context.getSharedPreferences(ApkDownloadReceiver.PREFS, Context.MODE_PRIVATE)
        if (updaterPrefs.getBoolean(ApkDownloadReceiver.DOWNLOAD_ACTIVE, false) ||
            updaterPrefs.getString(ApkDownloadReceiver.PENDING_URI, null) != null ||
            updaterPrefs.getString(ApkDownloadReceiver.SUPPRESS_TAG, null) != null) return@LaunchedEffect
        // Let the authenticated dashboard request use the network first on cold start.
        delay(2_000)
        checkingUpdate = true
        val release = withContext(Dispatchers.IO) { runCatching { NativeApi.latestRelease() }.getOrNull() }
        checkingUpdate = false
        if (release != null && isNativeUpdateAvailable(release.tag, context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "")) updateRelease = release
    }

    SideEffect {
        windowStatusBars(context, lightMode)
    }

    DisposableEffect(token) {
        val activity = context as? ComponentActivity
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                val updaterPrefs = context.getSharedPreferences(ApkDownloadReceiver.PREFS, Context.MODE_PRIVATE)
                if (updaterPrefs.getBoolean(ApkDownloadReceiver.DOWNLOAD_FAILED, false)) {
                    updaterPrefs.edit().putBoolean(ApkDownloadReceiver.DOWNLOAD_FAILED, false).apply()
                    updateNotice = L(locale, "فشل تنزيل التحديث أو تعذر التحقق من سلامته. تحقق من الاتصال ثم أعد المحاولة.", "Échec du téléchargement ou de la vérification du fichier. Vérifiez la connexion et réessayez.")
                }
                val pendingUri = updaterPrefs.getString(ApkDownloadReceiver.PENDING_URI, null)
                if (pendingUri != null &&
                    (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.packageManager.canRequestPackageInstalls())) {
                    // Resume the one-shot install after the user grants the
                    // permission, without restarting the download.
                    updaterPrefs.edit().remove(ApkDownloadReceiver.PENDING_URI).apply()
                    if (!installDownloadedApkUri(context, Uri.parse(pendingUri))) {
                        updateNotice = L(locale, "تعذر فتح شاشة تثبيت التحديث. حاول مرة أخرى.", "Impossible d’ouvrir l’installation. Réessayez.")
                    }
                }
                if (!firstResumeHandled) {
                    firstResumeHandled = true
                } else {
                    updateCheckNonce++
                    if (token != null) refreshNonce++
                }
            }
        }
        activity?.lifecycle?.addObserver(observer)
        onDispose { activity?.lifecycle?.removeObserver(observer) }
    }

    LaunchedEffect(token) {
        if (token == null) return@LaunchedEffect
        while (true) {
            delay(180_000)
            // Lifecycle resume already refreshes immediately. Avoid network and
            // JSON work while the app is backgrounded or the device is locked.
            if (token != null && MainActivity.isForeground) refreshNonce++
        }
    }

    LaunchedEffect(token, locale, refreshNonce) {
        val activeToken = token ?: return@LaunchedEffect
        val requestLocale = locale
        val requestSummary = section != Section.MATCHES
        loading = data == null
        if (data == null) connectionError = null
        val result = runCatching {
            withContext(Dispatchers.IO) { NativeApi.data(activeToken, requestLocale, summary = requestSummary) }
        }
        if (token == activeToken && locale == requestLocale) {
            result.onSuccess { payload ->
                user = payload.user.takeIf { it.id.isNotBlank() } ?: user
                // Apply the local deletion tombstones to every refresh path.  The
                // periodic refresh used to assign the raw payload here, which made
                // a deleted notification reappear on the next sync.
                val filteredPayload = visiblePayload(payload)
                data = if (requestSummary && section == Section.MATCHES && matchDetailsLoaded) filteredPayload.copy(matches = data?.matches.orEmpty()) else filteredPayload
                matchDetailsLoaded = !requestSummary
            }
                .onFailure { error ->
                    if (error is NativeSessionExpired) {
                        sessionStore.clear(); NativeApi.clearCachedData(context); token = null; user = null; data = null; playerStats = null
                        connectionError = L(requestLocale, "انتهت صلاحية الجلسة. سجّل الدخول مجددًا.", "Session expirée. Reconnectez-vous.")
                        connectionError = L(locale, "انتهت صلاحية الجلسة. سجّل الدخول مجددًا.", "Session expirée. Reconnectez-vous.")
                    } else {
                        connectionError = L(locale, "تعذر تحديث البيانات. تحقق من الاتصال وحاول مجددًا؛ بقيت جلستك محفوظة.", "Actualisation impossible. Vérifiez la connexion et réessayez ; votre session est conservée.")
                    }
                }
        }
        loading = false
    }

    LaunchedEffect(token, locale, section, matchDetailsLoaded) {
        val activeToken = token ?: return@LaunchedEffect
        if (section != Section.MATCHES || matchDetailsLoaded) return@LaunchedEffect
        val requestLocale = locale
        loading = true
        val result = runCatching { withContext(Dispatchers.IO) { NativeApi.data(activeToken, requestLocale) } }
        if (token == activeToken && locale == requestLocale) {
            result.onSuccess { payload ->
                data = visiblePayload(payload)
                user = payload.user.takeIf { it.id.isNotBlank() } ?: user
                matchDetailsLoaded = true
                connectionError = null
            }.onFailure { error ->
                connectionError = if (error is NativeSessionExpired) L(locale, "انتهت صلاحية الجلسة. سجّل الدخول مجددًا.", "Session expirée. Reconnectez-vous.") else L(locale, "تعذر تحميل تفاصيل المباريات. حاول مجددًا.", "Impossible de charger les détails des matchs. Réessayez.")
            }
        }
        loading = false
    }

    LaunchedEffect(token, locale, section, refreshNonce) {
        val activeToken = token ?: return@LaunchedEffect
        if (section != Section.PLAYER_STATS) return@LaunchedEffect
        val requestLocale = locale
        playerStatsError = null
        // Load the local snapshot before hitting the network so the list is
        // immediately useful, and a slow first sync cannot flash a false error.
        val cachedStats = if (playerStats == null) {
            withContext(Dispatchers.IO) { NativeApi.cachedPlayerStats(activeToken) }
        } else null
        if (token != activeToken || section != Section.PLAYER_STATS || locale != requestLocale) return@LaunchedEffect
        if (playerStats == null && cachedStats != null) {
            playerStats = cachedStats
            playerStatsError = null
        }
        playerStatsLoading = playerStats == null
        val result = runCatching { withContext(Dispatchers.IO) { NativeApi.playerStats(activeToken) } }
        if (token == activeToken && section == Section.PLAYER_STATS && locale == requestLocale) {
            result.onSuccess {
                playerStats = it
                // A successful response must clear a previous transient error;
                // otherwise the stale banner remains visible over fresh data.
                playerStatsError = null
            }
                .onFailure { error ->
                    if (error is NativeSessionExpired) {
                        sessionStore.clear(); NativeApi.clearCachedData(context); token = null; user = null; data = null; playerStats = null
                    } else if (playerStats == null) {
                        playerStatsError = L(requestLocale, "تعذرت مزامنة الإحصائيات. اسحب للتحديث أو تحقق من الاتصال.", "Impossible de synchroniser les statistiques. Actualisez ou vérifiez la connexion.")
                    } else {
                        // Keep cached results visible without a misleading error banner.
                        playerStatsError = null
                    }
                }
        }
        playerStatsLoading = false
    }

    fun updateMatch(match: NativeMatch, clubScore: Int, opponentScore: Int, status: String?) {
        val activeToken = token ?: return
        scope.launch {
            loading = true
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    val home = if (match.isHomeFixture) clubScore else opponentScore
                    val away = if (match.isHomeFixture) opponentScore else clubScore
                    NativeApi.updateScore(activeToken, match.id, home, away, status)
                    NativeApi.data(activeToken, locale)
                }
            }
            result.onSuccess { data = visiblePayload(it); connectionError = null }
                .onFailure { connectionError = L(locale, "تعذر حفظ التغيير. تحقق من الاتصال والصلاحيات.", "Impossible d’enregistrer. Vérifiez la connexion et les autorisations.") }
            loading = false
        }
    }

    fun addMatchEvent(match: NativeMatch, payload: org.json.JSONObject) {
        val activeToken = token ?: return
        scope.launch {
            loading = true
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    NativeApi.addMatchEvent(activeToken, match.id, payload)
                    NativeApi.data(activeToken, locale)
                }
            }
            result.onSuccess { data = visiblePayload(it); connectionError = null
                if (payload.optString("type") in setOf("GOAL", "PENALTY_GOAL", "OWN_GOAL")) {
                    NativeSoundEffects.play(context, R.raw.sound_goal_winner, soundEffectsEnabled)
                }
            }.onFailure { connectionError = L(locale, "تعذر حفظ الحدث. تأكد من المباراة واللاعب المختار.", "Événement non enregistré. Vérifiez le match et le joueur sélectionné.") }
            loading = false
        }
    }

    fun deleteMatchEvent(match: NativeMatch, event: NativeEvent) {
        val activeToken = token ?: return
        scope.launch {
            loading = true
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    NativeApi.deleteMatchEvent(activeToken, match.id, event.id)
                    NativeApi.data(activeToken, locale)
                }
            }
            result.onSuccess { data = visiblePayload(it); connectionError = null }
                .onFailure { connectionError = L(locale, "تعذر حذف الحدث؛ قد يكون رسميًا أو لا تملك الصلاحية.", "Suppression impossible ; l’événement est peut-être officiel ou votre compte n’a pas l’autorisation.") }
            loading = false
        }
    }

    fun saveCompetitionStandings(competition: NativeCompetition, standings: List<NativeStanding>) {
        val activeToken = token ?: return
        scope.launch {
            loading = true
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    NativeApi.updateCompetitionStandings(activeToken, competition.id, standings)
                    NativeApi.data(activeToken, locale, summary = true)
                }
            }
            result.onSuccess { data = visiblePayload(it); connectionError = null }
                .onFailure { error ->
                    if (error is NativeSessionExpired) { sessionStore.clear(); NativeApi.clearCachedData(context); token = null; user = null; data = null }
                    else connectionError = L(locale, "تعذر حفظ ترتيب المسابقة.", "Impossible d’enregistrer le classement.")
                }
            loading = false
        }
    }

    fun dismissAlert(alert: NativeAlert) {
        val activeToken = token ?: return
        scope.launch {
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    if (!alert.id.startsWith("meeting-")) NativeApi.deleteNotification(activeToken, alert.id)
                }
            }
            result.onSuccess {
                val next = dismissedAlertIds + alert.id
                dismissedAlertIds = next
                preferences.edit().putStringSet("dismissed_alert_ids", next).apply()
                data = data?.copy(alerts = data?.alerts.orEmpty().filterNot { it.id == alert.id })
            }.onFailure { error ->
                if (error is NativeSessionExpired) {
                    sessionStore.clear(); NativeApi.clearCachedData(context); token = null; user = null; data = null
                } else connectionError = L(locale, "تعذر حذف الإشعار. حاول مرة أخرى.", "Impossible de supprimer la notification. Réessayez.")
            }
        }
    }

    fun dismissAllAlerts() {
        val activeToken = token ?: return
        scope.launch {
            val result = runCatching { withContext(Dispatchers.IO) { NativeApi.deleteAllNotifications(activeToken) } }
            result.onSuccess {
                val next = dismissedAlertIds + data?.alerts.orEmpty().map { it.id }
                dismissedAlertIds = next
                preferences.edit().putStringSet("dismissed_alert_ids", next).apply()
                data = data?.copy(alerts = emptyList())
            }.onFailure { error ->
                if (error is NativeSessionExpired) {
                    sessionStore.clear(); NativeApi.clearCachedData(context); token = null; user = null; data = null
                } else connectionError = L(locale, "تعذر حذف الإشعارات. حاول مرة أخرى.", "Impossible de supprimer les notifications. Réessayez.")
            }
        }
    }

    CompositionLocalProvider(LocalLayoutDirection provides if (locale == "fr") LayoutDirection.Ltr else LayoutDirection.Rtl) {
    Box(Modifier.fillMaxSize().background(Ink)) {
        AppBackdrop()
        if (token == null) {
            NativeLoginScreen(connectionError = connectionError, loading = loading, locale = locale, lightMode = lightMode, onToggleTheme = { toggleTheme() }, onToggleLocale = { switchLocale() }) { email, password, rememberMe ->
                scope.launch {
                    loading = true
                    connectionError = null
                    val login = withContext(Dispatchers.IO) { NativeApi.login(email, password, locale, rememberMe) }
                    if (login.token != null && login.user != null) {
                        NativeSoundEffects.play(context, R.raw.sound_success_chime, soundEffectsEnabled)
                        sessionStore.write(login.token)
                        user = login.user
                        section = if (notificationRoutePending) Section.ALERTS else Section.HOME
                        val nativePushConfigured = NativeMessagingService.registerIfConfigured(context, login.token, locale)
                        if (nativePushConfigured && Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                            (context as? ComponentActivity)?.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 4301)
                        }
                        token = login.token
                    } else connectionError = login.error
                    loading = false
                }
            }
        } else {
            Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars)) {
                TopHeader(user?.role ?: L(locale, "حساب إداري", "Compte administrateur"), locale = locale, lightMode = lightMode, soundEffectsEnabled = soundEffectsEnabled, unreadCount = data?.alerts.orEmpty().count { !it.read }, clubLogoUrl = data?.clubLogoUrl, onToggleSoundEffects = { toggleSoundEffects() }, onToggleTheme = { toggleTheme() }, onCheckUpdate = { checkForUpdate() }, onToggleLocale = { switchLocale() }, onNotifications = { section = Section.ALERTS }, onLogout = {
                    val activeToken = token
                    sessionStore.clear(); NativeApi.clearCachedData(context); token = null; user = null; data = null; playerStats = null; playerStatsError = null
                    connectionError = null
                    section = Section.HOME
                    if (activeToken != null) scope.launch(Dispatchers.IO) {
                        runCatching {
                            val pushToken = context.getSharedPreferences(NativeMessagingService.PUSH_PREFS, android.content.Context.MODE_PRIVATE).getString(NativeMessagingService.PUSH_TOKEN_KEY, null)
                            if (pushToken != null) NativeApi.unregisterPush(activeToken, pushToken)
                            NativeApi.logout(activeToken)
                        }
                    }
                })
                SectionPage(section, data, user, loading, connectionError, locale, playerStats, playerStatsLoading, playerStatsError, onRetryPlayerStats = { refreshNonce++ }, onNavigate = { section = it }, onCreate = { createError = null; composerType = it }, onUpdateMatch = ::updateMatch, onAddEvent = ::addMatchEvent, onDeleteEvent = ::deleteMatchEvent, onSaveStandings = ::saveCompetitionStandings, onDeleteAlert = ::dismissAlert, onDeleteAllAlerts = ::dismissAllAlerts, modifier = Modifier.weight(1f).padding(bottom = 106.dp))
            }
            GlassNavigation(modifier = Modifier.align(Alignment.BottomCenter), selected = section, locale = locale, showPlayerStats = data?.permissions?.playerStats == true || user?.roleKey in setOf("developer", "super_admin"), showCompetitions = data?.permissions?.competitions == true, onSelect = { section = it })
        }
        composerType?.let { type ->
            NativeCreateDialog(type, data?.teams.orEmpty(), data?.coaches.orEmpty(), data?.permissions?.teamScopeRestricted == true, locale, isSubmitting = loading, errorMessage = createError, onDismiss = { composerType = null }) { payload ->
                val activeToken = token ?: return@NativeCreateDialog
                scope.launch {
                    createError = null
                    loading = true
                    val result = runCatching {
                        withContext(Dispatchers.IO) {
                            if (type == "news") {
                                val pickedUris = payload.optJSONArray("imageUris") ?: org.json.JSONArray()
                                val uploadedUrls = org.json.JSONArray()
                                for (index in 0 until pickedUris.length()) {
                                    uploadedUrls.put(NativeApi.uploadNewsImage(context, activeToken, Uri.parse(pickedUris.getString(index))))
                                }
                                payload.remove("imageUris")
                                payload.put("imageUrls", uploadedUrls)
                            }
                            NativeApi.createContent(activeToken, payload)
                            NativeApi.data(activeToken, locale)
                        }
                    }
                    result.onSuccess { data = visiblePayload(it); composerType = null; connectionError = L(locale, "تم النشر ومزامنة المنصة والموقع العام.", "Publié et synchronisé avec la plateforme et le site public.") }.onFailure { createError = L(locale, "تعذر النشر. تحقق من حجم الصور والاتصال ثم حاول مجددًا.", "Publication impossible. Vérifiez la taille des images et la connexion puis réessayez.") }
                    loading = false
                }
            }
        }
        if (updateDownloading) {
            AlertDialog(
                onDismissRequest = { },
                shape = RoundedCornerShape(22.dp),
                containerColor = Panel,
                title = { Text(L(locale, "تحديث التطبيق", "Mise à jour de l’application"), color = AppText, fontWeight = FontWeight.Bold, fontFamily = CairoFamily) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(L(locale, "يتم تنزيل التحديث داخل التطبيق والتحقق من سلامته…", "Téléchargement et vérification dans l’application…"), color = AppText, fontSize = 13.sp)
                        if (updateProgress == 0) {
                            androidx.compose.material3.LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = Mint, trackColor = Glass)
                        } else {
                            androidx.compose.material3.LinearProgressIndicator(progress = { updateProgress / 100f }, modifier = Modifier.fillMaxWidth(), color = Mint, trackColor = Glass)
                        }
                        Text("$updateProgress%", color = Mint, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.align(Alignment.CenterHorizontally))
                    }
                },
                confirmButton = { TextButton(onClick = {
                    updateDownloadJob?.cancel()
                    updateDownloadJob = null
                    val prefs = context.getSharedPreferences(ApkDownloadReceiver.PREFS, Context.MODE_PRIVATE)
                    prefs.getLong(ApkDownloadReceiver.PENDING_DOWNLOAD_ID, -1L).takeIf { it >= 0L }?.let { id ->
                        (context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).remove(id)
                    }
                    prefs.edit().remove(ApkDownloadReceiver.PENDING_DOWNLOAD_ID).remove(ApkDownloadReceiver.PENDING_SHA256).remove(ApkDownloadReceiver.PENDING_TAG).remove(ApkDownloadReceiver.SUPPRESS_TAG).putBoolean(ApkDownloadReceiver.DOWNLOAD_ACTIVE, false).apply()
                    updateDownloading = false
                }) { Text(L(locale, "إلغاء", "Annuler"), color = Muted) } }
            )
        }
        updateRelease?.let { release ->
            AlertDialog(
                onDismissRequest = { updateRelease = null; updateSnoozedThisSession = true },
                shape = RoundedCornerShape(22.dp),
                containerColor = Panel,
                title = { Text(L(locale, "تحديث جديد متاح", "Nouvelle mise à jour disponible"), color = AppText, fontWeight = FontWeight.Bold, fontFamily = CairoFamily) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(L(locale, "الإصدار ${release.tag} جاهز للتنزيل.", "La version ${release.tag} est prête à être téléchargée."), color = AppText, fontSize = 13.sp)
                        Text(L(locale, "اضغط تنزيل التحديث؛ عند اكتمال التحميل ستفتح شاشة التثبيت تلقائيًا. لن تحتاج إلى حذف التطبيق أو تسجيل الدخول من جديد.", "Appuyez sur Télécharger. L’installateur s’ouvrira dès la fin du téléchargement. Inutile de désinstaller l’application ou de vous reconnecter."), color = Muted, fontSize = 11.sp, lineHeight = 18.sp)
                    }
                },
                confirmButton = {
                    ClubPrimaryButton(
                        text = L(locale, "تنزيل التحديث", "Télécharger"),
                        onClick = {
                        updateProgress = 0
                        updateDownloading = true
                        updateRelease = null
                        updateDownloadJob = scope.launch {
                            runCatching {
                                // DownloadManager owns the transfer, so it
                                // continues if the Activity is paused, the
                                // user switches apps, or Android reclaims the
                                // process. The receiver verifies the checksum
                                // and stores the resulting content URI.
                                val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
                                val downloadId = manager?.let { withContext(Dispatchers.IO) { enqueueBackgroundUpdate(context, release) } } ?: -1L
                                if (downloadId < 0L || manager == null) {
                                    // Fallback for devices where DownloadManager
                                    // is disabled, restricted, or unavailable.
                                    val apkFile = withContext(Dispatchers.IO) {
                                        downloadUpdateDirect(context, release) { progress ->
                                            withContext(Dispatchers.Main) { if (progress > updateProgress) updateProgress = progress }
                                        }
                                    }
                                    updateProgress = 100
                                    updateDownloading = false
                                    updateDownloadJob = null
                                    if (!installDownloadedApk(context, apkFile)) error("installer_unavailable")
                                    return@launch
                                }
                                while (true) {
                                    val state = withContext(Dispatchers.IO) {
                                        manager.query(DownloadManager.Query().setFilterById(downloadId))?.use { cursor ->
                                            if (!cursor.moveToFirst()) null else {
                                                val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                                                val downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                                                val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                                                val progress = if (total > 0L) (downloaded * 100L / total).toInt().coerceIn(0, 99) else 0
                                                status to progress
                                            }
                                        }
                                    } ?: error("download_manager_missing")
                                    if (state.second > updateProgress) updateProgress = state.second
                                    when (state.first) {
                                        DownloadManager.STATUS_SUCCESSFUL -> {
                                            updateProgress = 100
                                            // The receiver normally verifies the
                                            // file and publishes PENDING_URI. If
                                            // Android delayed that broadcast,
                                            // verify the completed DownloadManager
                                            // file here instead of silently
                                            // ending the update flow.
                                            var pendingUri: String? = null
                                            for (attempt in 0 until 40) {
                                                pendingUri = context.getSharedPreferences(ApkDownloadReceiver.PREFS, Context.MODE_PRIVATE)
                                                    .getString(ApkDownloadReceiver.PENDING_URI, null)
                                                if (pendingUri != null) break
                                                delay(250)
                                            }
                                            if (pendingUri == null) {
                                                val completedUri = manager.getUriForDownloadedFile(downloadId)
                                                    ?: error("download_file_missing")
                                                val actualSha = withContext(Dispatchers.IO) {
                                                    context.contentResolver.openInputStream(completedUri)?.use { input ->
                                                        val digest = MessageDigest.getInstance("SHA-256")
                                                        val buffer = ByteArray(16 * 1024)
                                                        while (true) {
                                                            val count = input.read(buffer)
                                                            if (count < 0) break
                                                            digest.update(buffer, 0, count)
                                                        }
                                                        digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
                                                    } ?: error("download_file_unreadable")
                                                }
                                                if (!release.sha256.equals(actualSha, ignoreCase = true)) {
                                                    manager.remove(downloadId)
                                                    error("download_checksum_mismatch")
                                                }
                                                pendingUri = completedUri.toString()
                                                context.getSharedPreferences(ApkDownloadReceiver.PREFS, Context.MODE_PRIVATE).edit()
                                                    .remove(ApkDownloadReceiver.PENDING_DOWNLOAD_ID)
                                                    .remove(ApkDownloadReceiver.PENDING_SHA256)
                                                    .putString(ApkDownloadReceiver.PENDING_URI, pendingUri)
                                                    .putString(ApkDownloadReceiver.SUPPRESS_TAG, release.tag)
                                                    .putBoolean(ApkDownloadReceiver.DOWNLOAD_ACTIVE, false)
                                                    .putBoolean(ApkDownloadReceiver.DOWNLOAD_FAILED, false)
                                                    .apply()
                                            }
                                            updateDownloading = false
                                            updateDownloadJob = null
                                            pendingUri?.let { uriString ->
                                                val prefs = context.getSharedPreferences(ApkDownloadReceiver.PREFS, Context.MODE_PRIVATE)
                                                prefs.edit().remove(ApkDownloadReceiver.PENDING_URI).apply()
                                                if (!installDownloadedApkUri(context, Uri.parse(uriString))) error("installer_unavailable")
                                            }
                                            break
                                        }
                                        DownloadManager.STATUS_FAILED -> {
                                            // Some Android/OEM DownloadManager
                                            // builds reject CDN redirects or
                                            // transient TLS/network responses.
                                            // Clear its stale state and retry
                                            // through the app's verified HTTP
                                            // downloader before reporting an
                                            // actual failure to the user.
                                            val prefs = context.getSharedPreferences(ApkDownloadReceiver.PREFS, Context.MODE_PRIVATE)
                                            prefs.edit()
                                                .remove(ApkDownloadReceiver.PENDING_DOWNLOAD_ID)
                                                .remove(ApkDownloadReceiver.PENDING_SHA256)
                                                .remove(ApkDownloadReceiver.PENDING_TAG)
                                                .putBoolean(ApkDownloadReceiver.DOWNLOAD_ACTIVE, false)
                                                .apply()
                                            manager.remove(downloadId)
                                            val apkFile = withContext(Dispatchers.IO) {
                                                downloadUpdateDirect(context, release) { progress ->
                                                    withContext(Dispatchers.Main) { if (progress > updateProgress) updateProgress = progress }
                                                }
                                            }
                                            updateProgress = 100
                                            updateDownloading = false
                                            updateDownloadJob = null
                                            if (!installDownloadedApk(context, apkFile)) error("installer_unavailable")
                                            break
                                        }
                                        DownloadManager.STATUS_PAUSED,
                                        DownloadManager.STATUS_PENDING,
                                        DownloadManager.STATUS_RUNNING -> delay(250)
                                        else -> error("update_download_unknown")
                                    }
                                }
                            }.onFailure { error ->
                                updateDownloading = false
                                updateDownloadJob = null
                                context.getSharedPreferences(ApkDownloadReceiver.PREFS, Context.MODE_PRIVATE).edit()
                                    .remove(ApkDownloadReceiver.PENDING_DOWNLOAD_ID)
                                    .remove(ApkDownloadReceiver.PENDING_SHA256)
                                    .remove(ApkDownloadReceiver.PENDING_TAG)
                                    .remove(ApkDownloadReceiver.SUPPRESS_TAG)
                                    .putBoolean(ApkDownloadReceiver.DOWNLOAD_ACTIVE, false)
                                    .apply()
                                updateNotice = if (error.message == "installer_unavailable") {
                                    L(locale, "تعذر فتح شاشة تثبيت التحديث. افتح صلاحية تثبيت التطبيقات من إعدادات الهاتف ثم أعد المحاولة.", "Impossible d’ouvrir l’installation. Autorisez l’installation d’applications dans les réglages puis réessayez.")
                                } else if (error.message == "download_manager_unavailable") {
                                    L(locale, "تعذر بدء التنزيل في الخلفية. تحقق من إعدادات التنزيل ثم حاول مرة أخرى.", "Impossible de démarrer le téléchargement en arrière-plan. Vérifiez les réglages des téléchargements puis réessayez.")
                                } else {
                                    L(locale, "تعذر تنزيل التحديث. تحقق من الاتصال ثم حاول مرة أخرى.", "Impossible de télécharger la mise à jour. Vérifiez la connexion puis réessayez.")
                                }
                            }
                        }
                    }, modifier = Modifier.width(170.dp))
                },
                dismissButton = { TextButton(onClick = { updateRelease = null; updateSnoozedThisSession = true }) { Text(L(locale, "لاحقًا", "Plus tard"), color = Muted, fontFamily = CairoFamily) } }
            )
        }
        updateNotice?.let { message ->
            AlertDialog(onDismissRequest = { updateNotice = null }, text = { Text(message, color = AppText) }, confirmButton = { TextButton(onClick = { updateNotice = null }) { Text(L(locale, "حسنًا", "OK"), color = Red) } }, containerColor = Panel)
        }
    }
    }
}

private fun windowStatusBars(context: Context, light: Boolean) {
    val activity = context as? Activity ?: return
    val color = if (light) android.graphics.Color.rgb(242, 243, 245) else android.graphics.Color.rgb(17, 19, 21)
    activity.window.statusBarColor = color
    activity.window.navigationBarColor = color
    WindowInsetsControllerCompat(activity.window, activity.window.decorView).isAppearanceLightStatusBars = light
    WindowInsetsControllerCompat(activity.window, activity.window.decorView).isAppearanceLightNavigationBars = light
}

@Composable
private fun AmbientGlow(modifier: Modifier, color: Color) {
    Box(modifier.clip(CircleShape).background(Brush.radialGradient(listOf(color, color.copy(alpha = .08f), Color.Transparent))))
}

@Composable
private fun AppBackdrop() {
    Box(Modifier.fillMaxSize().background(Ink))
}

@Composable
private fun ClubPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier.fillMaxWidth(),
    enabled: Boolean = true,
    loading: Boolean = false
) {
    val shape = RoundedCornerShape(15.dp)
    Box(
        modifier.heightIn(min = 52.dp).clip(shape)
            .background(if (enabled) Red else if (nativeThemeIsLight) Color(0xFFE1E4E8) else Color(0xFF34383D))
            .border(1.dp, if (enabled) Red else GlassBorder, shape)
            .clickable(enabled = enabled && !loading, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            if (loading) CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(17.dp))
            Text(text, color = if (enabled || !nativeThemeIsLight) Color.White else Muted, fontWeight = FontWeight.Bold, fontFamily = CairoFamily, fontSize = 13.sp)
        }
    }
}

@Composable
private fun HeaderIconButton(icon: Int, description: String, tint: Color = AppText, onClick: () -> Unit) {
    Box(
        Modifier.size(38.dp).clip(RoundedCornerShape(13.dp)).background(Glass)
            .border(1.dp, GlassBorder, RoundedCornerShape(13.dp)).clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) { Icon(icon, contentDescription = description, tint = tint, modifier = Modifier.size(18.dp)) }
}

@Composable
private fun Icon(
    iconRes: Int,
    contentDescription: String?,
    tint: Color = Color.Unspecified,
    modifier: Modifier = Modifier,
    selectedIconRes: Int? = null,
    selected: Boolean = false
) {
    Image(
        painter = painterResource(if (selected) selectedIconRes ?: iconRes else iconRes),
        contentDescription = contentDescription,
        modifier = modifier,
        colorFilter = if (tint == Color.Unspecified) null else ColorFilter.tint(tint)
    )
}

@Composable
private fun IconlyAnimated(animationRes: Int, modifier: Modifier = Modifier) {
    val composition by rememberLottieComposition(LottieCompositionSpec.RawRes(animationRes))
    val progress by animateLottieCompositionAsState(composition = composition, iterations = 1)
    LottieAnimation(composition = composition, progress = { progress }, modifier = modifier)
}

@Composable
private fun TopHeader(role: String, locale: String, lightMode: Boolean, soundEffectsEnabled: Boolean, unreadCount: Int, clubLogoUrl: String?, onToggleSoundEffects: () -> Unit, onToggleTheme: () -> Unit, onCheckUpdate: () -> Unit, onToggleLocale: () -> Unit, onNotifications: () -> Unit, onLogout: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 13.dp, vertical = 7.dp)
            .shadow(14.dp, RoundedCornerShape(23.dp))
            .clip(RoundedCornerShape(23.dp))
            .background(if (lightMode) Color.White.copy(alpha = .84f) else Color(0xFF191B1F).copy(alpha = .86f))
            .border(1.dp, Brush.linearGradient(listOf(Color.White.copy(alpha = .22f), GlassBorder, Red.copy(alpha = .12f))), RoundedCornerShape(23.dp))
            .padding(horizontal = 11.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(Modifier.weight(1f).padding(end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp).clip(RoundedCornerShape(13.dp)).background(Brush.linearGradient(listOf(CardStart, CardEnd))).border(1.dp, GlassBorder, RoundedCornerShape(13.dp)), contentAlignment = Alignment.Center) {
                if (!clubLogoUrl.isNullOrBlank()) NativeRemoteImage(clubLogoUrl, Modifier.size(33.dp)) else Image(painterResource(R.drawable.esh_logo), contentDescription = "شعار النادي", modifier = Modifier.size(33.dp))
            }
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Text("E SIDI HOSNI", color = AppText, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = .45.sp, maxLines = 1)
                Text(L(locale, "إدارة ميدانية", "GESTION TERRAIN") + " · $role", color = Muted, fontSize = 8.sp, letterSpacing = .2.sp, maxLines = 1)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(38.dp).clip(RoundedCornerShape(13.dp)).background(Glass).border(1.dp, GlassBorder, RoundedCornerShape(13.dp)).clickable(onClick = onNotifications), contentAlignment = Alignment.Center) {
                    Icon(IconlyIcons.Notification, contentDescription = L(locale, "الإشعارات", "Notifications"), tint = AppText, modifier = Modifier.size(19.dp))
                    if (unreadCount > 0) {
                        val badge = if (unreadCount > 9) "+9" else unreadCount.toString()
                        Box(Modifier.align(Alignment.TopEnd).padding(top = 2.dp, end = 1.dp).height(15.dp).widthIn(min = 15.dp).clip(CircleShape).background(Red).padding(horizontal = 3.dp), contentAlignment = Alignment.Center) {
                            Text(badge, color = Color.White, fontSize = 8.sp, lineHeight = 9.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                        }
                    }
                }
                var menuExpanded by remember { mutableStateOf(false) }
                Box {
                    HeaderIconButton(IconlyIcons.Setting, L(locale, "الإعدادات", "Paramètres"), onClick = { menuExpanded = true })
                    DropdownMenu(
                        expanded = menuExpanded,
                        onDismissRequest = { menuExpanded = false },
                        modifier = Modifier,
                        shape = RoundedCornerShape(16.dp),
                        containerColor = Panel,
                        tonalElevation = 0.dp,
                        shadowElevation = 10.dp,
                        border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
                    ) {
                        DropdownMenuItem(
                            text = { Text(L(locale, if (lightMode) "الوضع الداكن" else "الوضع الفاتح", if (lightMode) "Mode sombre" else "Mode clair"), color = AppText, fontFamily = CairoFamily, fontSize = 13.sp) },
                            leadingIcon = { Icon(if (lightMode) IconlyIcons.Moon else IconlyIcons.Sun, contentDescription = null, tint = AppText) },
                            onClick = { menuExpanded = false; onToggleTheme() }
                        )
                        DropdownMenuItem(
                            text = { Text(L(locale, if (soundEffectsEnabled) "إيقاف أصوات التطبيق" else "تشغيل أصوات التطبيق", if (soundEffectsEnabled) "Désactiver les sons" else "Activer les sons"), color = AppText, fontFamily = CairoFamily, fontSize = 13.sp) },
                            leadingIcon = { Icon(IconlyIcons.Notification, contentDescription = null, tint = AppText) },
                            onClick = { menuExpanded = false; onToggleSoundEffects() }
                        )
                        DropdownMenuItem(
                            text = { Text(L(locale, "تحديث التطبيق", "Mettre à jour l’application"), color = AppText, fontFamily = CairoFamily, fontSize = 13.sp) },
                            leadingIcon = { Icon(IconlyIcons.Update, contentDescription = null, tint = AppText) },
                            onClick = { menuExpanded = false; onCheckUpdate() }
                        )
                        DropdownMenuItem(
                            text = { Text(if (locale == "ar") "Français" else "العربية", color = AppText, fontFamily = CairoFamily, fontSize = 13.sp) },
                            leadingIcon = { Icon(IconlyIcons.Language, contentDescription = null, tint = AppText) },
                            onClick = { menuExpanded = false; onToggleLocale() }
                        )
                        DropdownMenuItem(
                            text = { Text(L(locale, "تسجيل الخروج", "Déconnexion"), fontFamily = CairoFamily, fontSize = 13.sp, color = Red) },
                            leadingIcon = { Icon(IconlyIcons.Logout, contentDescription = null, tint = Red) },
                            onClick = { menuExpanded = false; onLogout() }
                        )
                    }
                }
            }
        }
    }
@Composable
private fun SectionPage(
    section: Section,
    data: NativeData?,
    user: NativeUser?,
    loading: Boolean,
    connectionError: String?,
    locale: String,
    playerStats: NativePlayerStats?,
    playerStatsLoading: Boolean,
    playerStatsError: String?,
    onRetryPlayerStats: () -> Unit,
    onNavigate: (Section) -> Unit,
    onCreate: (String) -> Unit,
    onUpdateMatch: (NativeMatch, Int, Int, String?) -> Unit,
    onAddEvent: (NativeMatch, org.json.JSONObject) -> Unit,
    onDeleteEvent: (NativeMatch, NativeEvent) -> Unit,
    onSaveStandings: (NativeCompetition, List<NativeStanding>) -> Unit,
    onDeleteAlert: (NativeAlert) -> Unit,
    onDeleteAllAlerts: () -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedStatPlayer by remember(section) { mutableStateOf<NativePlayerPerformance?>(null) }
    var playerStatsPage by remember(section) { mutableIntStateOf(0) }
    var isMorning by remember { mutableStateOf(java.time.LocalTime.now().hour in 6 until 12) }
    LaunchedEffect(Unit) {
        while (true) {
            val now = java.time.LocalDateTime.now()
            isMorning = now.hour in 6 until 12
            val nextBoundary = now.toLocalDate().atTime(java.time.LocalTime.of(if (isMorning) 12 else 6, 0))
                .let { if (it.isAfter(now)) it else it.plusDays(1) }
            delay(java.time.Duration.between(now, nextBoundary).toMillis().coerceAtLeast(1_000))
        }
    }
    val context = LocalContext.current
    DisposableEffect(context) {
        val activity = context as? ComponentActivity
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                isMorning = java.time.LocalTime.now().hour in 6 until 12
            }
        }
        activity?.lifecycle?.addObserver(observer)
        onDispose { activity?.lifecycle?.removeObserver(observer) }
    }
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(15.dp)
    ) {
        item {
            Column(Modifier.padding(bottom = 4.dp)) {
                Text(
                    if (section == Section.HOME) {
                        val name = user?.name?.takeIf { it.isNotBlank() }
                        val greeting = if (isMorning) L(locale, "صباح الخير", "Bonjour") else L(locale, "مساء الخير", "Bonsoir")
                        if (locale == "ar") "👋 $greeting${name?.let { "، $it" }.orEmpty()}"
                        else "👋 $greeting${name?.let { " $it" }.orEmpty()}"
                    } else section.title(locale),
                    color = AppText,
                    fontSize = 25.sp,
                    fontWeight = FontWeight.ExtraBold
                )
                Spacer(Modifier.height(5.dp))
                Text(section.subtitle(locale), color = Muted, fontSize = 12.sp)
            }
        }
        when (section) {
            Section.HOME -> {
                item { WelcomeCard(data, locale, onNavigate) }
                if (user != null) item { DigitalAdminCard(user, locale) }
        item { QuickActions(onNavigate, data, locale, onCreate) }
            }
            Section.MATCHES -> {
                if (data?.matches.isNullOrEmpty()) item { EmptyNativeSection(IconlyIcons.Match, L(locale, "إدارة المباريات", "Gestion des matchs"), L(locale, "لا توجد مباريات متاحة لحسابك حاليًا.", "Aucun match n’est disponible pour ce compte."), if (loading) L(locale, "جارٍ التحديث", "Actualisation…") else L(locale, "محدّث من المنصة", "Synchronisé avec la plateforme"), locale) }
                else items(data!!.matches, key = { it.id }) { match -> MatchCard(match, loading, locale, onUpdateMatch, onAddEvent, onDeleteEvent) }
            }
            Section.MEETINGS -> {
                val meetings = data?.upcomingMeetings.orEmpty() + data?.meetings.orEmpty()
                if (meetings.isEmpty()) item { EmptyNativeSection(IconlyIcons.Meeting, L(locale, "الاجتماعات", "Réunions"), L(locale, "لا توجد اجتماعات متاحة لحسابك حاليًا.", "Aucune réunion n’est disponible pour ce compte."), if (loading) L(locale, "جارٍ التحديث", "Actualisation…") else L(locale, "محدّث من المنصة", "Synchronisé avec la plateforme"), locale) }
                else items(meetings, key = { it.id }) { meeting -> MeetingCard(meeting, locale) }
            }
            Section.COMPETITIONS -> {
                val competitions = data?.competitions.orEmpty()
                if (competitions.isEmpty()) item { EmptyNativeSection(IconlyIcons.Star, L(locale, "المسابقات", "Compétitions"), L(locale, "لا توجد مسابقات مرتبطة بالموسم الحالي.", "Aucune compétition liée à la saison actuelle."), if (loading) L(locale, "جارٍ التحديث", "Actualisation…") else L(locale, "محدّث من المنصة", "Synchronisé avec la plateforme"), locale) }
                else items(competitions, key = { it.id }) { competition -> NativeCompetitionCard(competition, locale, onSaveStandings) }
            }
            Section.PLAYER_STATS -> {
                val players = playerStats?.players.orEmpty()
                val pageSize = 8
                val pageCount = ((players.size + pageSize - 1) / pageSize).coerceAtLeast(1)
                val currentPage = playerStatsPage.coerceIn(0, pageCount - 1)
                val visiblePlayers = players.drop(currentPage * pageSize).take(pageSize)
                item { PlayerStatsOverview(playerStats, playerStatsLoading, playerStatsError, locale, onRetryPlayerStats) }
                if (players.isNotEmpty()) items(visiblePlayers, key = { it.id }) { player ->
                    PlayerStatsCard(player, locale, selected = selectedStatPlayer?.id == player.id) {
                        selectedStatPlayer = if (selectedStatPlayer?.id == player.id) null else player
                    }
                }
                if (players.isNotEmpty() && pageCount > 1) item {
                    PlayerStatsPagination(currentPage, pageCount, locale, onPageChange = { next ->
                        playerStatsPage = next.coerceIn(0, pageCount - 1)
                        selectedStatPlayer = null
                    })
                }
            }
            Section.CALENDAR -> {
                val calendarItems = data?.calendarItems.orEmpty()
                if (calendarItems.isEmpty()) item { EmptyNativeSection(IconlyIcons.Calendar, L(locale, "الرزنامة", "Calendrier"), L(locale, "لا توجد أحداث قادمة. ستظهر هنا المباريات والتدريبات والاجتماعات والمواعيد الإدارية.", "Aucun événement à venir. Les matchs, entraînements, réunions et rendez-vous administratifs apparaîtront ici."), if (loading) L(locale, "جارٍ التحديث", "Actualisation…") else L(locale, "محدّث من المنصة", "Synchronisé avec la plateforme"), locale) }
                else items(calendarItems, key = { it.id }) { calendarItem -> CalendarItemCard(calendarItem, data?.clubLogoUrl, locale) }
            }
            Section.ALERTS -> {
                if (data?.alerts.isNullOrEmpty()) item { EmptyNativeSection(IconlyIcons.Notification, L(locale, "تنبيهات الهاتف", "Alertes téléphone"), L(locale, "لا توجد تنبيهات جديدة في حسابك.", "Aucune nouvelle notification."), if (loading) L(locale, "جارٍ التحديث", "Actualisation…") else L(locale, "محدّث من المنصة", "Synchronisé avec la plateforme"), locale) }
                else {
                    item {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                            TextButton(onClick = onDeleteAllAlerts) {
                                Icon(IconlyIcons.Close, contentDescription = null, tint = Red, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(5.dp))
                                Text(L(locale, "حذف الكل", "Tout supprimer"), color = Red, fontSize = 11.sp, fontFamily = CairoFamily)
                            }
                        }
                    }
                    items(data!!.alerts, key = { it.id }) { alert -> AlertCard(alert, locale, onDelete = { onDeleteAlert(alert) }) }
                }
            }
        }
    }
}

@Composable
private fun PlayerStatsOverview(stats: NativePlayerStats?, loading: Boolean, error: String?, locale: String, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(if (nativeThemeIsLight) listOf(Color(0xFFFFFFFF), Color(0xFFF2F6F5), Color(0xFFFFFFFF)) else listOf(Color(0xFF24272D), Color(0xFF191B20), Color(0xFF202329))))
            .border(1.dp, GlassBorder, RoundedCornerShape(24.dp)).padding(17.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(46.dp).clip(RoundedCornerShape(16.dp)).background(Red.copy(alpha = .13f)), contentAlignment = Alignment.Center) {
                Icon(IconlyIcons.Activity, contentDescription = null, tint = Red, modifier = Modifier.size(24.dp))
            }
            Column(Modifier.weight(1f)) {
                Text(L(locale, "أداء فئتك", "Performances de votre catégorie"), color = AppText, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp)
                Text(stats?.season?.let { L(locale, "موسم $it · مزامنة مباشرة", "Saison $it · synchronisé") } ?: L(locale, "إحصائيات محدثة من المنصة", "Statistiques synchronisées"), color = Muted, fontSize = 10.sp)
            }
            if (loading) CircularProgressIndicator(Modifier.size(19.dp), color = Red, strokeWidth = 2.dp)
            else HeaderIconButton(IconlyIcons.Refresh, L(locale, "تحديث", "Actualiser"), tint = Mint, onClick = onRetry)
        }
        if (error != null && stats == null) Text(error, color = if (nativeThemeIsLight) Color(0xFFB4232E) else Color(0xFFFF8E96), fontSize = 11.sp, lineHeight = 17.sp)
        else if (stats != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NativeMiniStat(L(locale, "اللاعبون", "Joueurs"), stats.players.size.toString(), IconlyIcons.People, Mint, Modifier.weight(1f))
                NativeMiniStat(L(locale, "الأهداف", "Buts"), stats.players.sumOf { it.goals }.toString(), IconlyIcons.GoalBall, Color(0xFFFFC45D), Modifier.weight(1f))
                NativeMiniStat(L(locale, "المشاركات", "Apparitions"), stats.players.sumOf { it.appearances }.toString(), IconlyIcons.Activity, Color(0xFF7DB8FF), Modifier.weight(1f))
            }
        } else if (!loading) Text(L(locale, "لا يوجد لاعبون نشطون ضمن الفئات المرتبطة بحسابك.", "Aucun joueur actif dans les catégories attribuées."), color = Muted, fontSize = 11.sp)
    }
}

@Composable
private fun NativeMiniStat(label: String, value: String, icon: Int, color: Color, modifier: Modifier = Modifier) {
    Column(modifier.clip(RoundedCornerShape(15.dp)).background(if (nativeThemeIsLight) Color(0xFFF1F4F6) else Color.White.copy(alpha = .035f)).border(1.dp, GlassBorder.copy(alpha = .65f), RoundedCornerShape(15.dp)).padding(horizontal = 10.dp, vertical = 11.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(13.dp))
            Text(label, color = Muted, fontSize = 9.sp, maxLines = 1)
        }
        Text(value, color = AppText, fontSize = 18.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 5.dp))
    }
}

@Composable
private fun PlayerStatsPagination(page: Int, pageCount: Int, locale: String, onPageChange: (Int) -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Glass).border(1.dp, GlassBorder, RoundedCornerShape(16.dp)).padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        TextButton(
            enabled = page > 0,
            onClick = { onPageChange(page - 1) },
            modifier = Modifier.heightIn(min = 44.dp).widthIn(min = 52.dp)
        ) {
            Icon(if (locale == "ar") IconlyIcons.ArrowRight else IconlyIcons.ArrowLeft, contentDescription = L(locale, "الصفحة السابقة", "Page précédente"), tint = if (page > 0) Mint else Muted, modifier = Modifier.size(24.dp))
            Spacer(Modifier.width(4.dp))
            Text(L(locale, "السابق", "Précédent"), color = if (page > 0) AppText else Muted, fontSize = 11.sp)
        }
        Text(L(locale, "صفحة ${page + 1} من $pageCount", "Page ${page + 1} sur $pageCount"), color = Muted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        TextButton(
            enabled = page < pageCount - 1,
            onClick = { onPageChange(page + 1) },
            modifier = Modifier.heightIn(min = 44.dp).widthIn(min = 52.dp)
        ) {
            Text(L(locale, "التالي", "Suivant"), color = if (page < pageCount - 1) AppText else Muted, fontSize = 11.sp)
            Spacer(Modifier.width(4.dp))
            Icon(if (locale == "ar") IconlyIcons.ArrowLeft else IconlyIcons.ArrowRight, contentDescription = L(locale, "الصفحة التالية", "Page suivante"), tint = if (page < pageCount - 1) Mint else Muted, modifier = Modifier.size(24.dp))
        }
    }
}

@Composable
private fun PlayerStatsCard(player: NativePlayerPerformance, locale: String, selected: Boolean, onClick: () -> Unit) {
    val name = if (locale == "fr") "${player.firstNameFr ?: player.firstName} ${player.lastNameFr ?: player.lastName}" else "${player.firstName} ${player.lastName}"
    val category = when (player.category) { "SENIOR" -> L(locale, "الأكابر", "Seniors"); "U20" -> "U20"; "U17" -> "U17"; "U15" -> "U15"; else -> player.category }
    val teamName = teamNameWithoutCategory(player.team, player.category)
    val position = when (player.position) { "GOALKEEPER" -> L(locale, "حارس مرمى", "Gardien"); "DEFENDER" -> L(locale, "مدافع", "Défenseur"); "MIDFIELDER" -> L(locale, "وسط ميدان", "Milieu"); "FORWARD" -> L(locale, "مهاجم", "Attaquant"); else -> player.position }
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Brush.horizontalGradient(if (nativeThemeIsLight) listOf(Color(0xFFFFFFFF), Color(0xFFF4F7F8)) else listOf(Color(0xFF202329), Color(0xFF191B20))))
            .border(1.dp, if (selected) Red.copy(alpha = .65f) else GlassBorder, RoundedCornerShape(20.dp))
            .animateContentSize(animationSpec = tween(320))
            .clickable(onClick = onClick).padding(13.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
        PlayerAvatar(player.photoUrl, player.number, 42.dp, Red)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(name, color = AppText, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
            Text(listOf(category, teamName, position).filter { it.isNotBlank() }.distinctBy { it.trim().lowercase() }.joinToString(" · "), color = Muted, fontSize = 9.sp, maxLines = 1)
            Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                Text("⚽ ${player.goals}", color = Color(0xFFFFC45D), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                Text("${L(locale, "تمريرات", "PD")} ${player.assists}", color = Mint, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                Text("${L(locale, "مباريات", "MJ")} ${player.appearances}", color = AppText.copy(alpha = .78f), fontSize = 10.sp)
            }
        }
            Icon(IconlyIcons.ArrowLeft, contentDescription = L(locale, "التفاصيل", "Détails"), tint = if (selected) Red else Muted, modifier = Modifier.size(18.dp))
        }
        AnimatedVisibility(visible = selected, enter = expandVertically(tween(320)) + fadeIn(tween(220)), exit = shrinkVertically(tween(260)) + fadeOut(tween(160))) {
            PlayerStatsDetail(player, locale)
        }
    }
}

@Composable
private fun PlayerStatsDetail(player: NativePlayerPerformance, locale: String) {
    val position = when (player.position) { "GOALKEEPER" -> L(locale, "حارس مرمى", "Gardien"); "DEFENDER" -> L(locale, "مدافع", "Défenseur"); "MIDFIELDER" -> L(locale, "وسط ميدان", "Milieu"); "FORWARD" -> L(locale, "مهاجم", "Attaquant"); else -> player.position }
    val teamName = teamNameWithoutCategory(player.team, player.category)
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Brush.linearGradient(listOf(Glass, Panel))).border(1.dp, GlassBorder, RoundedCornerShape(24.dp)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(L(locale, "تفاصيل الإحصائيات", "Détails des statistiques"), color = AppText, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp)
                Text(listOf(teamName, position).filter { it.isNotBlank() }.distinctBy { it.trim().lowercase() }.joinToString(" · "), color = Muted, fontSize = 9.sp, maxLines = 1)
            }
            Box(Modifier.clip(RoundedCornerShape(9.dp)).background(Red.copy(alpha = .15f)).padding(horizontal = 9.dp, vertical = 5.dp)) {
                Text(L(locale, "مفصلة", "Détaillée"), color = Red, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NativeMiniStat(L(locale, "مشاركات", "MJ"), player.appearances.toString(), IconlyIcons.Match, Color(0xFF7DB8FF), Modifier.weight(1f))
            NativeMiniStat(L(locale, "أساسي", "Titul."), player.starts.toString(), IconlyIcons.Star, Color(0xFFFFC45D), Modifier.weight(1f))
            NativeMiniStat(L(locale, "أهداف", "Buts"), player.goals.toString(), IconlyIcons.GoalBall, Red, Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NativeMiniStat(L(locale, "تمريرات حاسمة", "Passes D."), player.assists.toString(), IconlyIcons.Activity, Mint, Modifier.weight(1f))
            NativeMiniStat("xG", "${"%.2f".format(java.util.Locale.US, player.xg)}", IconlyIcons.Activity, Color(0xFFB79BFF), Modifier.weight(1f))
        }
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(if (nativeThemeIsLight) Color(0xFFF1F4F6) else Color.White.copy(alpha = .035f)).padding(13.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text(L(locale, "تفاصيل الأداء", "Détails de performance"), color = AppText, fontWeight = FontWeight.Bold, fontSize = 11.sp)
            NativeDetailLine(L(locale, "التسديدات", "Tirs"), "${player.shots} · ${player.shotsOnTarget} ${L(locale, "على المرمى", "cadrés")}")
            NativeDetailLine(L(locale, "تغطية xG", "Couverture xG"), "${player.xgShots} / ${player.shots}")
            NativeDetailLine(L(locale, "البطاقات الصفراء / الحمراء", "Cartons jaunes / rouges"), "${player.yellowCards} / ${player.redCards}")
            NativeDetailLine(L(locale, "التسديد بالقدمين / الرأس", "Tirs pied droit / pied gauche / tête"), "${player.rightFootShots} / ${player.leftFootShots} / ${player.headShots}")
            NativeDetailLine(L(locale, "الأهداف: يمين / يسار / رأس / أخرى", "Buts : droit / gauche / tête / autres"), "${player.rightFootGoals} / ${player.leftFootGoals} / ${player.headGoals} / ${player.otherGoals}")
        }
        if (player.recentMatches.isNotEmpty()) {
            Text(L(locale, "آخر المشاركات", "Dernières apparitions"), color = AppText, fontWeight = FontWeight.Bold, fontSize = 11.sp)
            player.recentMatches.forEach { match ->
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(11.dp)).background(if (nativeThemeIsLight) Color(0xFFF6F8F9) else Color.White.copy(alpha = .025f)).padding(horizontal = 10.dp, vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(match.opponent, color = AppText, fontSize = 9.sp, modifier = Modifier.weight(1f), maxLines = 1)
                    Text(if (match.isStarting) L(locale, "أساسي", "Titulaire") else L(locale, "بديل", "Remplaçant"), color = if (match.isStarting) Mint else Muted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        Text(L(locale, "الإحصائيات متزامنة مباشرة مع بيانات المنصة.", "Statistiques synchronisées avec la plateforme."), color = Muted, fontSize = 9.sp)
    }
}

/** Avatar used by the player list and expanded stats. The shirt number is a
 * separate badge outside the photo circle, while the image keeps its full
 * portrait visible and is aligned toward the face instead of cropping it. */
@Composable
private fun PlayerAvatar(photoUrl: String?, number: Int?, size: Dp, accent: Color) {
    Box(Modifier.size(size), contentAlignment = Alignment.Center) {
        Box(Modifier.matchParentSize().clip(CircleShape).background(Brush.linearGradient(listOf(accent.copy(alpha = .22f), Mint.copy(alpha = .13f)))).border(1.dp, accent.copy(alpha = .3f), CircleShape), contentAlignment = Alignment.Center) {
            // Keep portrait pixels away from the avatar's circular edge. The
            // previous full-bleed photo filled the circle and visibly clipped
            // the sides of player portraits in the compact stats list.
            if (!photoUrl.isNullOrBlank()) NativeRemoteImage(photoUrl, Modifier.size(size * 0.86f).clip(CircleShape))
            else Text(number?.toString() ?: "—", color = AppText, fontSize = (size.value * .34f).sp, fontWeight = FontWeight.Black)
        }
        number?.let {
            Box(Modifier.align(Alignment.BottomEnd).offset(x = 6.dp, y = 5.dp).zIndex(2f).clip(RoundedCornerShape(7.dp)).background(accent).border(1.dp, Color.White.copy(alpha = .75f), RoundedCornerShape(7.dp)).padding(horizontal = 5.dp, vertical = 2.dp)) {
                Text(it.toString(), color = Color.White, fontSize = 8.sp, lineHeight = 9.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun NativeDetailLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = Muted, fontSize = 9.sp, modifier = Modifier.weight(1f))
        Text(value, color = AppText, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun WelcomeCard(data: NativeData?, locale: String, onNavigate: (Section) -> Unit) {
    val featuredMatch = data?.matches.orEmpty()
        .firstOrNull { it.status == "LIVE" }
        ?: data?.matches.orEmpty().firstOrNull { it.status == "SCHEDULED" }
        ?: data?.matches.orEmpty().firstOrNull()
    val matchAccent = if (featuredMatch?.status == "LIVE") Red else Mint
    Column(verticalArrangement = Arrangement.spacedBy(11.dp)) {
        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(26.dp)).background(Brush.linearGradient(
            if (nativeThemeIsLight) listOf(Color(0xFFFFFFFF), Color(0xFFFAFBFC), Color(0xFFF6F7F8))
            else listOf(Color(0xFF202328), Color(0xFF1B1E22), Color(0xFF17191C))
        )).border(1.dp, GlassBorder, RoundedCornerShape(26.dp))) {
            AmbientGlow(Modifier.align(Alignment.TopEnd).offset(x = 70.dp, y = (-95).dp).size(230.dp), if (featuredMatch?.status == "LIVE") RedGlow else MintGlow)
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        if (!data?.clubLogoUrl.isNullOrBlank()) NativeRemoteImage(data!!.clubLogoUrl!!, Modifier.size(38.dp).clip(CircleShape).background(Color.White).padding(2.dp)) else Image(painterResource(R.drawable.esh_logo), contentDescription = null, modifier = Modifier.size(38.dp).clip(CircleShape).background(Color.White).padding(2.dp))
                        Column {
                            Text("E SIDI HOSNI", color = AppText, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = .5.sp)
                            Text(L(locale, "المركز الميداني للنادي", "Centre opérationnel du club"), color = Muted, fontSize = 9.sp)
                        }
                    }
                    Row(Modifier.clip(CircleShape).background(matchAccent.copy(alpha = .12f)).border(1.dp, matchAccent.copy(alpha = .24f), CircleShape).padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Box(Modifier.size(6.dp).background(matchAccent, CircleShape))
                        Text(if (featuredMatch?.status == "LIVE") L(locale, "مباشر", "EN DIRECT") else L(locale, "محدّث", "À JOUR"), color = matchAccent, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                }

                if (featuredMatch != null) {
                    Text(L(locale, "المباراة الأخيرة", "DERNIER MATCH"), color = Muted, fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Box(Modifier.size(40.dp).clip(RoundedCornerShape(14.dp)).background(Color.White.copy(alpha = .08f)).border(1.dp, GlassBorder, RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
                                if (!data?.clubLogoUrl.isNullOrBlank()) NativeRemoteImage(data!!.clubLogoUrl!!, Modifier.size(32.dp)) else Image(painterResource(R.drawable.esh_logo), contentDescription = null, modifier = Modifier.size(32.dp))
                            }
                            Text(L(locale, "أمل سيدي حسني", "E Sidi Hosni"), color = AppText, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(if (featuredMatch.status == "SCHEDULED") "VS" else {
                                val clubScore = featuredMatch.clubScore ?: 0
                                val opponentScore = featuredMatch.opponentScore ?: 0
                                if (featuredMatch.isHomeFixture) "$clubScore : $opponentScore" else "$opponentScore : $clubScore"
                            }, color = AppText, fontSize = 22.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                            Text(featuredMatch.competition.ifBlank { L(locale, "مباراة النادي", "Match du club") }, color = Muted, fontSize = 8.sp, maxLines = 1)
                        }
                        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            Box(Modifier.size(40.dp).clip(RoundedCornerShape(14.dp)).background(Brush.linearGradient(listOf(Red.copy(alpha = .22f), Glass))).border(1.dp, Red.copy(alpha = .20f), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
                                if (!featuredMatch.opponentLogo.isNullOrBlank()) {
                                    NativeRemoteImage(featuredMatch.opponentLogo!!, Modifier.size(32.dp).clip(RoundedCornerShape(10.dp)))
                                } else {
                                    Icon(IconlyIcons.GoalBall, contentDescription = null, tint = Color(0xFFFF737A), modifier = Modifier.size(24.dp))
                                }
                            }
                            Text(featuredMatch.opponent, color = AppText, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                        }
                    }
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(featuredMatch.date.take(16).replace('T', ' '), color = Muted, fontSize = 9.sp)
                        Text(featuredMatch.statusLabel(locale), color = matchAccent, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                } else {
                    Text(L(locale, "كل شؤون النادي في مكان واحد", "Toute la vie du club, au même endroit"), color = AppText, fontSize = 21.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 29.sp)
                    Text(L(locale, "المباريات والاجتماعات والمستجدات، متزامنة مع المنصة.", "Matchs, réunions et actualités synchronisés avec la plateforme."), color = Muted, fontSize = 11.sp, lineHeight = 18.sp)
                }

                Box(Modifier.fillMaxWidth().height(1.dp).background(GlassBorder))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CompactMetric(IconlyIcons.Match, data?.matches?.size?.toString() ?: "—", L(locale, "مباراة", "matchs"))
                        CompactMetric(IconlyIcons.Meeting, data?.upcomingMeetings?.size?.toString() ?: "—", L(locale, "اجتماع", "réunions"))
                    }
                    Row(Modifier.clip(RoundedCornerShape(13.dp)).background(Red).clickable { onNavigate(Section.MATCHES) }.padding(horizontal = 13.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        val canManageMatches = data?.permissions?.updateMatches == true
                        Text(
                            if (canManageMatches) L(locale, "إدارة المباريات", "Gérer les matchs") else L(locale, "المباريات", "Matchs"),
                            color = Color.White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Icon(if (locale == "ar") IconlyIcons.ArrowLeft else IconlyIcons.ArrowRight, contentDescription = null, tint = Color.White, modifier = Modifier.size(15.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun CompactMetric(icon: Int, value: String, label: String) {
    Row(Modifier.clip(RoundedCornerShape(12.dp)).background(Glass).border(1.dp, GlassBorder, RoundedCornerShape(12.dp)).padding(horizontal = 9.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Icon(icon, contentDescription = null, tint = Mint, modifier = Modifier.size(14.dp))
        Text(value, color = AppText, fontWeight = FontWeight.ExtraBold, fontSize = 11.sp)
        Text(label, color = Muted, fontSize = 9.sp)
    }
}

@Composable
private fun DigitalAdminCard(user: NativeUser, locale: String) {
    var flipped by remember(user.id) { mutableStateOf(false) }
    val rotation by animateFloatAsState(if (flipped) 180f else 0f, tween(720), label = "license-card-flip")
    val sweep = remember(user.id) { Animatable(-1.35f) }
    LaunchedEffect(user.id) {
        sweep.snapTo(-1.35f)
        // A slow, single pass keeps the physical-card details readable.
        sweep.animateTo(1.45f, animationSpec = tween(durationMillis = 2800))
    }
    val embeddedImage by produceState<ImageBitmap?>(initialValue = null, user.image) {
        value = withContext(Dispatchers.IO) {
            runCatching {
                val source = user.image?.takeIf { it.isNotBlank() } ?: return@runCatching null
                if (source.startsWith("data:image/", ignoreCase = true)) {
                    val encoded = source.substringAfter(',', "")
                    if (encoded.isBlank()) null else Base64.decode(encoded, Base64.DEFAULT).let { bytes ->
                        ByteArrayInputStream(bytes).use { BitmapFactory.decodeStream(it)?.asImageBitmap() }
                    }
                } else null
            }.getOrNull()
        }
    }
    val frenchSurname = user.lastNameFr?.trim().orEmpty()
    val frenchGivenName = user.firstNameFr?.trim().orEmpty()
    val frenchName = listOf(frenchSurname.uppercase(), frenchGivenName).filter { it.isNotBlank() }.joinToString(" ")
    val accountNameHasLatin = user.name.any { Character.UnicodeScript.of(it.code) == Character.UnicodeScript.LATIN }
    val displayName = frenchName.ifBlank { user.name.takeIf { accountNameHasLatin }.orEmpty() }.ifBlank { "—" }
    val displayNameLines = when {
        frenchSurname.isNotBlank() && frenchGivenName.isNotBlank() -> listOf(frenchSurname.uppercase(), frenchGivenName)
        displayName.trim().split(Regex("\\s+")).size > 2 -> {
            val words = displayName.trim().split(Regex("\\s+"))
            listOf(words.first(), words.drop(1).joinToString(" "))
        }
        else -> listOf(displayName)
    }
    val birthDate = user.dateOfBirth?.take(10)?.let { raw ->
        runCatching { java.time.LocalDate.parse(raw).format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy", java.util.Locale.FRANCE)) }.getOrNull()
    } ?: "—"
    val paper = Color(0xFFF5F2E8)
    val ink = Color(0xFF28323A)
    val leagueRed = Color(0xFFB43E51)
    val federationGreen = Color(0xFF41775D)
    val violet = Color(0xFF6659AC)
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints(
            Modifier.fillMaxWidth().aspectRatio(1.55f)
                .clickable { flipped = !flipped }
        ) {
            val cardWidth = maxWidth
            val cardHeight = maxHeight
            // Rotate one complete card surface. Keeping the paper, border,
            // shadow, and both faces in this layer prevents the frame from
            // appearing fixed while only the inner content flips.
            Box(
                Modifier.fillMaxSize()
                    .shadow(7.dp, RoundedCornerShape(13.dp))
                    .clip(RoundedCornerShape(13.dp))
                    .background(paper)
                    .border(1.dp, Color(0xFFD1C8B2), RoundedCornerShape(12.dp))
                    .graphicsLayer { rotationY = rotation; cameraDistance = 28f * density }
            ) {
                if (rotation > 90f) {
                    BackDigitalCard(cardWidth, cardHeight)
                } else {
            val fontScale = (cardWidth / 360.dp).coerceIn(.82f, 1.16f)
            Canvas(Modifier.fillMaxSize()) {
                val pitch = 4.dp.toPx()
                val amplitude = 2.2.dp.toPx()
                val wavelength = 48.dp.toPx()
                fun drawPhysicalWaves() {
                    var startX = -size.height
                    while (startX < size.width) {
                        val path = androidx.compose.ui.graphics.Path()
                        var y = 0f
                        path.moveTo(startX, 0f)
                        while (y <= size.height) {
                            val wave = kotlin.math.sin((y / wavelength) * (2.0 * Math.PI)).toFloat() * amplitude
                            path.lineTo(startX + y * .48f + wave, y)
                            y += 2.dp.toPx()
                        }
                        drawPath(path, Color(0x247A7568), style = androidx.compose.ui.graphics.drawscope.Stroke(width = .48.dp.toPx()))
                        startX += pitch
                    }
                }
                // The physical card keeps the wave engraving concentrated in
                // the header and footer bands, leaving the photo and details
                // readable instead of covering the whole card.
                clipRect(top = 0f, bottom = size.height * .30f) { drawPhysicalWaves() }
                clipRect(top = size.height * .76f, bottom = size.height) { drawPhysicalWaves() }
                val sideTop = size.height * .36f
                val sideHeight = size.height * .42f
                val sideWidth = size.width * .095f
                drawRect(violet, Offset(0f, sideTop), Size(sideWidth, sideHeight))
                drawRect(violet, Offset(size.width - sideWidth, sideTop), Size(sideWidth, sideHeight))
                val accentX = size.width * .132f
                drawLine(Color(0xFF968BBF), Offset(accentX, sideTop + 4.dp.toPx()), Offset(accentX, size.height - 12.dp.toPx()), strokeWidth = 1.8.dp.toPx())
            }

            LicenseSeal(
                R.drawable.faf_logo,
                "Fédération Algérienne de Football",
                Modifier.offset(x = cardWidth * .025f, y = cardHeight * .035f).size(36.dp * fontScale)
            )
            LicenseSeal(
                R.drawable.tiaret_league_logo,
                "Ligue Wilaya de Football – Tiaret",
                Modifier.align(Alignment.TopEnd).offset(x = -(cardWidth * .025f), y = cardHeight * .035f).size(36.dp * fontScale)
            )
            Column(
                Modifier.offset(x = cardWidth * .155f, y = cardHeight * .025f)
                    .width(cardWidth * .69f).height(cardHeight * .22f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text("Fédération Algérienne de Football", color = federationGreen, fontSize = (11.5f * fontScale).sp, lineHeight = (14f * fontScale).sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
                Text("Ligue Wilaya de Football – Tiaret", color = leagueRed, fontSize = (11f * fontScale).sp, lineHeight = (13f * fontScale).sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
            }

            Box(
                Modifier.offset(x = cardWidth * .132f, y = cardHeight * .282f)
                    .width(cardWidth * .22f).height(cardHeight * .46f)
                    .background(Color.White).border(1.dp, Color(0xFFAAA99F))
                    .padding(3.dp)
            ) {
                if (!user.image.isNullOrBlank() && !user.image.startsWith("data:image/", ignoreCase = true)) {
                    NativeRemoteImage(user.image, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, fallback = {
                        if (embeddedImage != null) Image(bitmap = embeddedImage!!, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                        else Box(Modifier.fillMaxSize().background(Color(0xFFE6E3DA)), contentAlignment = Alignment.Center) {
                            Text(displayName.take(1).ifBlank { "?" }.uppercase(), color = ink, fontSize = (26f * fontScale).sp, fontWeight = FontWeight.Black)
                        }
                    })
                } else if (embeddedImage != null) {
                    Image(bitmap = embeddedImage!!, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                } else {
                    Box(Modifier.fillMaxSize().background(Color(0xFFE6E3DA)), contentAlignment = Alignment.Center) {
                        Text(displayName.take(1).ifBlank { "?" }.uppercase(), color = ink, fontSize = (26f * fontScale).sp, fontWeight = FontWeight.Black)
                    }
                }
            }

            Column(
                Modifier.offset(x = cardWidth * .425f, y = cardHeight * .30f)
                    .width(cardWidth * .545f).height(cardHeight * .49f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                displayNameLines.forEachIndexed { index, line ->
                    val sizeAdjustment = if (line.length > 18) .82f else if (line.length > 14) .9f else 1f
                    Text(
                        line,
                        color = ink,
                        fontSize = (14.5f * fontScale * sizeAdjustment).sp,
                        lineHeight = (16.5f * fontScale).sp,
                        fontWeight = FontWeight.Black,
                        maxLines = 1,
                        softWrap = false,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                LicenseDetail("Né le :", birthDate, ink, fontScale)
                LicenseDetail("Groupage :", user.bloodGroup?.takeIf { it.isNotBlank() } ?: "—", ink, fontScale)
                Box(Modifier.padding(top = 3.dp).width(cardWidth * .38f).heightIn(min = 22.dp).clip(RoundedCornerShape(50)).background(violet).padding(horizontal = 6.dp, vertical = 4.dp), contentAlignment = Alignment.Center) {
                    Text("Saison : ${user.season?.takeIf { it.isNotBlank() } ?: "—"}", modifier = Modifier.fillMaxWidth(), color = Color.White, fontSize = (8.1f * fontScale).sp, lineHeight = (9.8f * fontScale).sp, fontWeight = FontWeight.Bold, maxLines = 1, softWrap = false, overflow = TextOverflow.Clip, textAlign = TextAlign.Center)
                }
            }

            Box(
                Modifier
                    .offset(x = with(LocalDensity.current) { (cardWidth.toPx() * sweep.value).toDp() })
                    .width(cardWidth * .24f)
                    .fillMaxHeight()
                    .graphicsLayer { rotationZ = 12f }
                    .graphicsLayer { alpha = .78f }
                    .background(Brush.horizontalGradient(listOf(Color.Transparent, Color.White.copy(alpha = .25f), Color.Transparent)))
            )

            Row(
                Modifier.offset(x = cardWidth * .12f, y = cardHeight * .835f)
                    .width(cardWidth * .80f).height(cardHeight * .13f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(user.licenseNumber?.takeIf { it.isNotBlank() } ?: "—", modifier = Modifier.weight(.40f), color = ink, fontSize = (14f * fontScale).sp, lineHeight = (17f * fontScale).sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(user.licenseRole?.takeIf { it.isNotBlank() } ?: "—", modifier = Modifier.weight(.60f), color = ink, fontSize = (10.5f * fontScale).sp, lineHeight = (12.5f * fontScale).sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
                }
            }
        }
    }
}

@Composable
private fun BackDigitalCard(cardWidth: androidx.compose.ui.unit.Dp, cardHeight: androidx.compose.ui.unit.Dp) {
    val paper = Color(0xFFF5F2E8)
    val ink = Color(0xFF28323A)
    val violet = Color(0xFF6659AC)
    Box(Modifier.fillMaxSize().graphicsLayer { rotationY = 180f }) {
        Canvas(Modifier.fillMaxSize()) {
            val w = size.width; val h = size.height
            drawRect(paper)
            // Back layout follows the physical card in its natural landscape
            // orientation: QR and data block on the left, crest/name on the
            // right, and the disclaimer in the bottom purple band.
            val stripe = androidx.compose.ui.graphics.Path().apply { moveTo(0f, h * .76f); lineTo(w * .53f, 0f); lineTo(w * .68f, 0f); lineTo(w * .14f, h * .84f); close() }
            drawPath(stripe, Color(0xFFD2D9D8))
            drawRect(violet, Offset(w * .18f, 0f), Size(w * .17f, h * .10f))
            drawRect(violet, Offset(w * .40f, h * .62f), Size(w * .13f, h * .11f))
            drawRect(violet, Offset(w * .02f, h * .84f), Size(w * .12f, h * .10f))
            drawRect(violet, Offset(w * .83f, h * .84f), Size(w * .15f, h * .11f))
            drawRect(violet, Offset(w * .02f, h * .88f), Size(w * .96f, h * .10f))
            var x = -h
            while (x < w) { drawLine(Color(0x1A7A7568), Offset(x, 0f), Offset(x + h * .28f, h), strokeWidth = 1.dp.toPx()); x += 7.dp.toPx() }
        }
        Image(painterResource(R.drawable.esh_logo), contentDescription = "E Sidi Hosni", modifier = Modifier.offset(x = cardWidth * .63f, y = cardHeight * .16f).size(cardWidth * .18f), contentScale = ContentScale.Fit)
        Text("E Sidi Hosni", modifier = Modifier.offset(x = cardWidth * .57f, y = cardHeight * .43f).width(cardWidth * .31f), color = ink, fontFamily = CairoFamily, fontSize = (13f * (cardWidth / 360.dp)).sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
        val qrMatrix = remember { QRCodeWriter().encode("https://esh-platform-vercel-preview.vercel.app", BarcodeFormat.QR_CODE, 128, 128) }
        Box(Modifier.offset(x = cardWidth * .10f, y = cardHeight * .26f).size(cardWidth * .22f, cardHeight * .36f).background(Color.White).border(1.dp, ink).padding(7.dp), contentAlignment = Alignment.Center) {
            Canvas(Modifier.fillMaxSize()) {
                val cellW = size.width / qrMatrix.width
                val cellH = size.height / qrMatrix.height
                for (r in 0 until qrMatrix.height) for (c in 0 until qrMatrix.width) if (qrMatrix[c, r]) drawRect(ink, Offset(c * cellW, r * cellH), Size(cellW + .25f, cellH + .25f))
            }
        }
        Text("SPORT DATA", modifier = Modifier.offset(x = cardWidth * .07f, y = cardHeight * .64f).width(cardWidth * .29f), color = ink, fontFamily = CairoFamily, fontSize = (11f * (cardWidth / 360.dp)).sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
        Text("Carte personnelle et obligatoire à chaque rencontre", modifier = Modifier.align(Alignment.BottomCenter).offset(y = -(cardHeight * .012f)).width(cardWidth * .86f), color = Color.White, fontFamily = CairoFamily, fontSize = (7f * (cardWidth / 360.dp)).sp, textAlign = TextAlign.Center, maxLines = 1, softWrap = false)
    }
}

@Composable
private fun LicenseSeal(imageRes: Int, label: String, modifier: Modifier = Modifier) {
    Image(
        painter = painterResource(imageRes),
        contentDescription = label,
        modifier = modifier,
        contentScale = ContentScale.Fit
    )
}

@Composable
private fun LicenseDetail(label: String, value: String, color: Color, scale: Float) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, color = color, fontSize = (12f * scale).sp, lineHeight = (14f * scale).sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(value, color = color, fontSize = (13f * scale).sp, lineHeight = (15f * scale).sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun MetricChip(label: String, value: String, icon: Int) {
    Row(Modifier.clip(RoundedCornerShape(15.dp)).background(Glass).border(1.dp, GlassBorder, RoundedCornerShape(15.dp)).padding(horizontal = 13.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = Red, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(8.dp))
        Text(label, color = Muted, fontSize = 10.sp)
        Spacer(Modifier.width(10.dp))
        Text(value, color = AppText, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun QuickActions(onNavigate: (Section) -> Unit, data: NativeData?, locale: String, onCreate: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(11.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Column {
                Text(L(locale, "مساحة العمل", "Espace de travail"), color = AppText, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                Text(L(locale, "إجراءات مباشرة مرتبطة بحسابك", "Actions liées à votre compte"), color = Muted, fontSize = 9.sp)
            }
            Box(Modifier.size(7.dp).background(Mint, CircleShape))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            if (data?.permissions?.updateMatches == true) {
            ActionTile(L(locale, "إدارة مباراة", "Gérer un match"), L(locale, "النتيجة والأحداث", "Score et événements"), IconlyIcons.Match, Red, onClick = { onNavigate(Section.MATCHES) }, modifier = Modifier.weight(1f))
            }
            ActionTile(L(locale, "الاجتماعات", "Réunions"), L(locale, "المواعيد والتنبيهات", "Dates et rappels"), IconlyIcons.Meeting, Mint, onClick = { onNavigate(Section.MEETINGS) }, modifier = Modifier.weight(1f))
        }
        if (data?.permissions?.competitions == true) {
            ActionTile(L(locale, "المسابقات", "Compétitions"), L(locale, "الترتيب الرسمي للفئات", "Classements officiels"), IconlyIcons.Star, Color(0xFFFFC45D), onClick = { onNavigate(Section.COMPETITIONS) })
        }
        if (data?.permissions?.playerStats == true) {
            ActionTile(L(locale, "إحصائيات اللاعبين", "Statistiques joueurs"), L(locale, "أداء لاعبي الفئات ومؤشراتهم", "Performances et indicateurs des joueurs"), IconlyIcons.Activity, Color(0xFF7C5CFC), onClick = { onNavigate(Section.PLAYER_STATS) })
        }
        if (data?.permissions?.training == true || data?.permissions?.announcements == true) {
            Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                if (data.permissions.training) ActionTile(L(locale, "إضافة تدريب", "Ajouter un entraînement"), L(locale, "إلى جدول النادي", "Au calendrier du club"), IconlyIcons.Activity, Mint, onClick = { onCreate("training") }, modifier = Modifier.weight(1f))
                if (data.permissions.announcements) ActionTile(L(locale, "إضافة إعلان", "Publier une annonce"), L(locale, "على الموقع العام", "Sur le site public"), IconlyIcons.Document, Red, onClick = { onCreate("announcement") }, modifier = Modifier.weight(1f))
            }
        }
        if (data?.permissions?.news == true) {
            ActionTile(L(locale, "إضافة خبر", "Publier une actualité"), L(locale, "باللغتين على الموقع العام", "En arabe et en français sur le site"), IconlyIcons.Paper, Red, onClick = { onCreate("news") })
        }
        if (data?.permissions?.scheduleMeetings == true) {
            ActionTile(L(locale, "إضافة اجتماع", "Planifier une réunion"), L(locale, "لفئتك مع إرسال تنبيه", "Pour votre équipe avec alerte"), IconlyIcons.Meeting, Mint, onClick = { onCreate("meeting") })
        }
    }
}

@Composable
private fun ActionTile(title: String, detail: String, icon: Int, accent: Color, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) .975f else 1f, label = "action-tile-press")
    val iconScale by animateFloatAsState(if (pressed) .84f else 1f, label = "action-icon-press")
    val shape = RoundedCornerShape(20.dp)
    Column(modifier.graphicsLayer { scaleX = scale; scaleY = scale }.clip(shape)
        .background(Brush.linearGradient(listOf(CardStart, CardEnd)))
        .border(1.dp, if (pressed) accent.copy(alpha = .34f) else GlassBorder, shape)
        .clickable(interactionSource = interaction, indication = null, onClick = onClick)
        .padding(14.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Box(Modifier.size(38.dp).clip(RoundedCornerShape(13.dp)).background(Brush.linearGradient(listOf(accent.copy(alpha = .24f), accent.copy(alpha = .08f)))), contentAlignment = Alignment.Center) {
                Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(20.dp).graphicsLayer { scaleX = iconScale; scaleY = iconScale })
            }
            Icon(if (LocalLayoutDirection.current == LayoutDirection.Rtl) IconlyIcons.ArrowLeft else IconlyIcons.ArrowRight, contentDescription = null, tint = Muted, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.height(12.dp))
        Text(title, color = AppText, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        Spacer(Modifier.height(3.dp))
        Text(detail, color = Muted, fontSize = 9.sp, maxLines = 1)
    }
}

@Composable
private fun MatchCard(
    match: NativeMatch,
    saving: Boolean,
    locale: String,
    onUpdate: (NativeMatch, Int, Int, String?) -> Unit,
    onAddEvent: (NativeMatch, org.json.JSONObject) -> Unit,
    onDeleteEvent: (NativeMatch, NativeEvent) -> Unit
) {
    var expanded by remember(match.id) { mutableStateOf(false) }
    var clubScore by remember(match.id, match.clubScore) { mutableIntStateOf(match.clubScore ?: 0) }
    var opponentScore by remember(match.id, match.opponentScore) { mutableIntStateOf(match.opponentScore ?: 0) }
    var eventToDelete by remember(match.id) { mutableStateOf<NativeEvent?>(null) }
    val clubSide = if (match.isHomeFixture) "HOME" else "AWAY"
    val displayedScore = if (match.isHomeFixture) "${match.clubScore ?: 0} : ${match.opponentScore ?: 0}" else "${match.opponentScore ?: 0} : ${match.clubScore ?: 0}"
    val currentClubScore = if (match.isHomeFixture) clubScore else opponentScore
    val currentOpponentScore = if (match.isHomeFixture) opponentScore else clubScore
    val statusAccent = when (match.status) { "LIVE" -> Red; "FINISHED" -> Mint; "POSTPONED" -> Color(0xFFF0A52B); else -> Muted }
    val shape = RoundedCornerShape(22.dp)
    Column(Modifier.fillMaxWidth().animateContentSize().clip(shape).background(Brush.linearGradient(listOf(CardStart, CardEnd))).border(1.dp, GlassBorder, shape)) {
        Box(Modifier.fillMaxWidth().height(3.dp).background(statusAccent))
        Column(Modifier.fillMaxWidth().clickable { expanded = !expanded }.padding(15.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Box(Modifier.size(6.dp).background(statusAccent, CircleShape))
                        Text(match.competition.ifBlank { L(locale, "مباراة النادي", "Match du club") }, color = Red, fontSize = 9.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                    }
                    Text(match.opponent, color = AppText, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        Icon(IconlyIcons.Calendar, contentDescription = null, tint = Muted, modifier = Modifier.size(12.dp))
                        Text(match.date.take(16).replace('T', ' '), color = Muted, fontSize = 9.sp, maxLines = 1)
                    }
                }
                Column(Modifier.clip(RoundedCornerShape(15.dp)).background(RedGlow).border(1.dp, Red.copy(alpha = .19f), RoundedCornerShape(15.dp)).padding(horizontal = 14.dp, vertical = 9.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(displayedScore, color = Red, fontSize = 21.sp, fontWeight = FontWeight.Black, maxLines = 1)
                    Text(L(locale, "النادي  ·  الخصم", "CLUB  ·  ADV."), color = Muted, fontSize = 8.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                MatchStatChip(L(locale, "التسديدات", "Tirs"), "${match.shotsFor}  ·  ${match.shotsAgainst}", IconlyIcons.Activity)
                MatchStatChip("xG", "${"%.2f".format(java.util.Locale.US, match.xgFor)}  ·  ${"%.2f".format(java.util.Locale.US, match.xgAgainst)}", IconlyIcons.GoalBall)
                MatchStatChip(L(locale, "البطاقات", "Cartons"), "${match.yellowCardsFor} 🟨  ${match.redCardsFor} 🟥", IconlyIcons.Match)
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                val latestEvents = match.events.takeLast(2)
                Text(
                    if (latestEvents.isNotEmpty()) latestEvents.joinToString("   ·   ") { "${it.minute}′ ${it.playerName ?: eventLabel(it.type, locale)}" }
                    else match.statusLabel(locale),
                    color = if (match.status == "LIVE") statusAccent else Muted,
                    fontSize = 9.sp,
                    fontWeight = if (match.status == "LIVE") FontWeight.Bold else FontWeight.Normal,
                    maxLines = 1,
                    modifier = Modifier.weight(1f)
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(if (expanded) L(locale, "إخفاء التفاصيل", "Réduire") else L(locale, "التفاصيل", "Détails"), color = Muted, fontSize = 9.sp)
                    Icon(IconlyIcons.ArrowDown, contentDescription = null, tint = Muted, modifier = Modifier.size(14.dp).graphicsLayer { rotationZ = if (expanded) 180f else 0f })
                }
            }
        }
        AnimatedVisibility(
            visible = expanded,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically()
        ) {
            Column(Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, bottom = 15.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.fillMaxWidth().height(1.dp).background(GlassBorder))
                if (match.canUpdate) {
                    Text(L(locale, "تعديل النتيجة وحالة المباراة", "Score et état du match"), color = AppText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Glass).border(1.dp, GlassBorder, RoundedCornerShape(14.dp)).padding(10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceEvenly) {
                        ScoreStepper(L(locale, "فريق النادي", "Notre équipe"), currentClubScore) { value ->
                            if (!saving && value >= 0) { clubScore = value; onUpdate(match, if (match.isHomeFixture) value else currentOpponentScore, if (match.isHomeFixture) currentOpponentScore else value, null) }
                        }
                        Text(":", color = Muted, fontWeight = FontWeight.Bold)
                        ScoreStepper(L(locale, "الخصم", "Adversaire"), currentOpponentScore) { value ->
                            if (!saving && value >= 0) { opponentScore = value; onUpdate(match, if (match.isHomeFixture) currentClubScore else value, if (match.isHomeFixture) value else currentClubScore, null) }
                        }
                    }
                    val statusActions = when (match.status) {
                        "SCHEDULED" -> listOf("LIVE" to L(locale, "بدء المباراة", "Démarrer"), "POSTPONED" to L(locale, "تأجيل", "Reporter"))
                        "LIVE" -> listOf("FINISHED" to L(locale, "إنهاء المباراة", "Terminer"), "POSTPONED" to L(locale, "تأجيل", "Reporter"))
                        "FINISHED" -> listOf("LIVE" to L(locale, "إعادة فتح المباراة", "Rouvrir le match"))
                        "POSTPONED" -> listOf("SCHEDULED" to L(locale, "إعادتها للجدول", "Remettre au calendrier"))
                        else -> listOf("SCHEDULED" to L(locale, "إعادة جدولة المباراة", "Reprogrammer"))
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        statusActions.forEach { (status, label) ->
                            val primary = status == "LIVE" || status == "FINISHED"
                            Text(label, color = if (primary) Color.White else AppText, fontSize = 10.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                                modifier = Modifier.weight(1f).clip(RoundedCornerShape(11.dp)).background(if (primary) Red else Glass).border(1.dp, if (primary) Red else GlassBorder, RoundedCornerShape(11.dp)).clickable(enabled = !saving) { onUpdate(match, clubScore, opponentScore, status) }.padding(horizontal = 8.dp, vertical = 11.dp))
                        }
                    }
                }
                if (match.events.isNotEmpty()) {
                    Text(L(locale, "أحداث المباراة", "Événements du match"), color = AppText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        match.events.asReversed().forEach { event ->
                            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Glass).border(1.dp, GlassBorder, RoundedCornerShape(10.dp)).padding(horizontal = 10.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text("${event.minute}′", color = Red, fontSize = 11.sp, fontWeight = FontWeight.Black)
                                Spacer(Modifier.width(9.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(event.playerName?.let { "$it · ${eventLabel(event.type, locale)}" } ?: eventLabel(event.type, locale), color = AppText, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    Text(if (event.side == clubSide) L(locale, "النادي", "Club") else L(locale, "الخصم", "Adversaire"), color = Muted, fontSize = 9.sp)
                                }
                                event.xG?.let { Text("xG ${"%.2f".format(java.util.Locale.US, it)}", color = Mint, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                                if (match.canReport && event.source == "MANUAL") {
                                    Spacer(Modifier.width(8.dp))
                                    Icon(IconlyIcons.Close, contentDescription = L(locale, "حذف الحدث", "Supprimer l’événement"), tint = Red, modifier = Modifier.size(19.dp).clickable(enabled = !saving) { eventToDelete = event })
                                }
                            }
                        }
                    }
                } else {
                    val emptyEventsMessage = when (match.status) {
                        "FINISHED" -> L(locale, "لم تُسجَّل أحداث في هذه المباراة.", "Aucun événement n’a été enregistré pour ce match.")
                        "SCHEDULED" -> L(locale, "لم تبدأ المباراة بعد.", "Le match n’a pas encore commencé.")
                        "LIVE" -> L(locale, "لم تُسجَّل أحداث بعد.", "Aucun événement enregistré pour le moment.")
                        else -> L(locale, "لا توجد أحداث مسجلة.", "Aucun événement enregistré.")
                    }
                    Text(emptyEventsMessage, color = Muted, fontSize = 11.sp)
                }
                if (match.canReport && (match.status == "LIVE" || match.status == "FINISHED")) {
                    NativeMatchEventComposer(match, saving, locale, onAddEvent)
                }
            }
        }
    }
    eventToDelete?.let { target ->
        AlertDialog(
            onDismissRequest = { eventToDelete = null },
            title = { Text(L(locale, "حذف الحدث؟", "Supprimer l’événement ?"), color = AppText, fontWeight = FontWeight.Bold) },
            text = { Text(L(locale, "سيُحذف الحدث وتُعدّل النتيجة تلقائيًا إذا كان هدفًا. الأحداث الرسمية لا يمكن حذفها.", "L’événement sera supprimé et le score ajusté s’il s’agit d’un but. Les événements officiels sont protégés."), color = Muted) },
            confirmButton = { TextButton(onClick = { onDeleteEvent(match, target); eventToDelete = null }) { Text(L(locale, "حذف", "Supprimer"), color = Red) } },
            dismissButton = { TextButton(onClick = { eventToDelete = null }) { Text(L(locale, "إلغاء", "Annuler"), color = Muted) } },
            containerColor = Panel
        )
    }
}

@Composable
private fun RowScope.MatchStatChip(label: String, value: String, icon: Int) {
    Column(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(Glass).border(1.dp, GlassBorder, RoundedCornerShape(12.dp)).padding(horizontal = 9.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(icon, contentDescription = null, tint = Red.copy(alpha = .85f), modifier = Modifier.size(11.dp))
            Text(label, color = Muted, fontSize = 8.sp, fontWeight = FontWeight.Medium, maxLines = 1)
        }
        Text(value, color = AppText, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

@Composable
private fun NativeMatchEventComposer(match: NativeMatch, saving: Boolean, locale: String, onAddEvent: (NativeMatch, org.json.JSONObject) -> Unit) {
    val clubSide = if (match.isHomeFixture) "HOME" else "AWAY"
    var eventType by remember(match.id, match.events.size) { mutableStateOf("GOAL") }
    var side by remember(match.id, match.events.size) { mutableStateOf(clubSide) }
    var minute by remember(match.id, match.events.size) { mutableStateOf("1") }
    var playerId by remember(match.id, match.events.size) { mutableStateOf(match.players.firstOrNull()?.id.orEmpty()) }
    var outgoingPlayerId by remember(match.id, match.events.size) { mutableStateOf("") }
    var playerName by remember(match.id, match.events.size) { mutableStateOf("") }
    var outgoingPlayerName by remember(match.id, match.events.size) { mutableStateOf("") }
    var assistId by remember(match.id, match.events.size) { mutableStateOf("") }
    var bodyPart by remember(match.id, match.events.size) { mutableStateOf("RIGHT_FOOT") }
    var situation by remember(match.id, match.events.size) { mutableStateOf("OPEN_PLAY") }
    var outcome by remember(match.id, match.events.size) { mutableStateOf("SAVED") }
    var shotPoint by remember(match.id, match.events.size) { mutableStateOf<Pair<Float, Float>?>(null) }
    val isClub = side == clubSide
    val isShot = eventType in setOf("GOAL", "SHOT", "PENALTY_GOAL", "PENALTY_MISSED")
    val penalty = eventType == "PENALTY_GOAL" || eventType == "PENALTY_MISSED"
    val isGoal = eventType == "GOAL" || eventType == "PENALTY_GOAL"
    val isSubstitution = eventType == "SUBSTITUTION_IN"
    val eventTypes = listOf(
        "GOAL" to L(locale, "هدف", "But"), "SHOT" to L(locale, "تسديدة", "Tir"),
        "PENALTY_GOAL" to L(locale, "هدف جزاء", "But sur penalty"), "PENALTY_MISSED" to L(locale, "جزاء ضائع", "Penalty manqué"),
        "OWN_GOAL" to L(locale, "هدف عكسي", "But contre son camp"), "YELLOW_CARD" to L(locale, "بطاقة صفراء", "Carton jaune"),
        "RED_CARD" to L(locale, "بطاقة حمراء", "Carton rouge"), "SUBSTITUTION_IN" to L(locale, "تبديل", "Remplacement")
    )
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(Brush.linearGradient(listOf(CardStart, CardEnd))).border(1.dp, GlassBorder, RoundedCornerShape(17.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Text(L(locale, "تسجيل حدث ميداني", "Ajouter un événement"), color = AppText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        NativeDropdownField(L(locale, "نوع الحدث", "Événement"), eventTypes.first { it.first == eventType }.second, L(locale, "اختر الحدث", "Choisir"), eventTypes, onSelected = { eventType = it; shotPoint = null })
        NativeDropdownField(L(locale, "الفريق", "Équipe"), if (side == clubSide) L(locale, "النادي", "Club") else match.opponent, L(locale, "اختر الفريق", "Choisir l’équipe"), listOf(clubSide to L(locale, "النادي", "Club"), (if (clubSide == "HOME") "AWAY" else "HOME") to match.opponent), onSelected = { side = it; playerName = ""; playerId = match.players.firstOrNull()?.id.orEmpty() })
        OutlinedTextField(value = minute, onValueChange = { minute = it.filter(Char::isDigit).take(3) }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text(L(locale, "الدقيقة", "Minute")) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
        if (isClub) {
            val eligiblePlayers = match.players
            NativeDropdownField(
                L(locale, if (isSubstitution) "اللاعب الداخل" else "لاعب النادي", if (isSubstitution) "Joueur entrant" else "Joueur du club"),
                eligiblePlayers.firstOrNull { it.id == playerId }?.let { it.number?.let { n -> "$n · " }.orEmpty() + it.name } ?: "",
                if (eligiblePlayers.isEmpty()) L(locale, "لاعبو الفئة غير متاحين", "Aucun joueur disponible") else L(locale, "اختر لاعبًا", "Choisir un joueur"),
                eligiblePlayers.map { player -> player.id to (player.number?.let { "$it · " }.orEmpty() + (if (locale == "fr" && player.nameFr.isNotBlank()) player.nameFr else player.name)) },
                onSelected = { playerId = it }
            )
            if (isSubstitution) NativeDropdownField(L(locale, "اللاعب الخارج", "Joueur sortant"), match.players.firstOrNull { it.id == outgoingPlayerId }?.name.orEmpty(), L(locale, "اختر اللاعب الخارج", "Choisir le joueur sortant"), match.players.filter { it.id != playerId }.map { it.id to it.name }, onSelected = { outgoingPlayerId = it })
        } else {
            OutlinedTextField(value = playerName, onValueChange = { playerName = it.take(120) }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text(L(locale, "اسم لاعب الخصم", "Joueur adverse")) }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
            if (isSubstitution) OutlinedTextField(value = outgoingPlayerName, onValueChange = { outgoingPlayerName = it.take(120) }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text(L(locale, "اسم اللاعب الخارج", "Joueur sortant")) }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
        }
        if (isShot && isClub) {
            if (isGoal) NativeDropdownField(L(locale, "طريقة التسديد", "Finition"), bodyPartLabel(bodyPart, locale), L(locale, "اختر الطريقة", "Choisir"), listOf("RIGHT_FOOT" to L(locale, "القدم اليمنى", "Pied droit"), "LEFT_FOOT" to L(locale, "القدم اليسرى", "Pied gauche"), "HEAD" to L(locale, "الرأس", "Tête"), "OTHER" to L(locale, "أخرى", "Autre")), onSelected = { bodyPart = it })
            if (!penalty) NativeDropdownField(L(locale, "نوع الهجمة", "Phase de jeu"), situationLabel(situation, locale), L(locale, "اختر النوع", "Choisir"), listOf("OPEN_PLAY" to L(locale, "لعب مفتوح", "Jeu ouvert"), "FREE_KICK" to L(locale, "ركلة حرة", "Coup franc"), "CORNER" to L(locale, "ركنية", "Corner"), "OTHER" to L(locale, "أخرى", "Autre")), onSelected = { situation = it })
            if (eventType == "SHOT") NativeDropdownField(L(locale, "نتيجة التسديدة", "Résultat"), outcomeLabel(outcome, locale), L(locale, "اختر النتيجة", "Choisir"), listOf("SAVED" to L(locale, "تصدى لها الحارس", "Arrêtée"), "OFF_TARGET" to L(locale, "خارج المرمى", "Hors cadre"), "BLOCKED" to L(locale, "مصدودة", "Contrée"), "WOODWORK" to L(locale, "القائم أو العارضة", "Poteau / barre")), onSelected = { outcome = it })
            if (isGoal && match.players.size > 1) NativeDropdownField(L(locale, "التمريرة الحاسمة (اختياري)", "Passe décisive (facultatif)"), match.players.firstOrNull { it.id == assistId }?.name.orEmpty(), L(locale, "بدون تمريرة حاسمة", "Sans passe décisive"), listOf("" to L(locale, "بدون تمريرة حاسمة", "Sans passe décisive")) + match.players.filter { it.id != playerId }.map { it.id to it.name }, onSelected = { assistId = it })
            if (!penalty) {
                ShotLocationPicker(
                    point = shotPoint,
                    locale = locale,
                    onPoint = { x, y -> shotPoint = x to y },
                    onClear = { shotPoint = null }
                )
            } else {
                Text(L(locale, "xG ركلة الجزاء يُحسب تلقائيًا (0.76)", "Le xG du penalty est calculé automatiquement (0,76)"), color = Mint, fontSize = 10.sp)
            }
        }
        val canSave = !saving && minute.toIntOrNull() != null && (if (isClub) playerId.isNotBlank() else playerName.isNotBlank()) && (!isSubstitution || if (isClub) outgoingPlayerId.isNotBlank() else outgoingPlayerName.isNotBlank()) && (!isShot || !isClub || eventType in setOf("PENALTY_GOAL", "PENALTY_MISSED") || shotPoint != null)
        ClubPrimaryButton(text = L(locale, "إضافة الحدث", "Ajouter l’événement"), enabled = canSave, onClick = {
            val payload = org.json.JSONObject().put("type", eventType).put("side", side).put("minute", minute.toIntOrNull() ?: 0)
            if (isClub) payload.put("playerId", playerId) else payload.put("playerName", playerName.trim())
            if (isSubstitution) { if (isClub) payload.put("outPlayerId", outgoingPlayerId) else payload.put("outPlayerName", outgoingPlayerName.trim()) }
            if (isGoal && isClub) payload.put("bodyPart", bodyPart)
            if (isShot && isClub) {
                payload.put("situation", if (penalty) "PENALTY" else situation)
                if (eventType == "SHOT") payload.put("outcome", outcome)
                shotPoint?.let { payload.put("x", it.first.toDouble()).put("y", it.second.toDouble()) }
                if (assistId.isNotBlank()) payload.put("assistPlayerId", assistId)
            }
            onAddEvent(match, payload)
        })
    }
}

@Composable
private fun ShotLocationPicker(
    point: Pair<Float, Float>?,
    locale: String,
    onPoint: (Float, Float) -> Unit,
    onClear: () -> Unit
) {
    val markerScale by animateFloatAsState(if (point == null) .9f else 1.08f, label = "shot-marker")
    val fieldShape = RoundedCornerShape(17.dp)
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(19.dp))
            .background(Brush.linearGradient(if (nativeThemeIsLight) listOf(Color(0xFFEFF5F2), Color(0xFFE6EEEA)) else listOf(Color(0xFF171E1C), Color(0xFF101514))))
            .border(1.dp, if (point != null) Mint.copy(alpha = .30f) else GlassBorder, RoundedCornerShape(19.dp))
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp)
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(L(locale, "موقع التسديدة", "Emplacement du tir"), color = AppText, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Text(L(locale, "المس الملعب لتحديد نقطة احتساب xG", "Touchez le terrain pour définir le point xG"), color = Muted, fontSize = 9.sp)
            }
            Row(Modifier.clip(CircleShape).background((if (point == null) Red else Mint).copy(alpha = .12f)).padding(horizontal = 9.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Box(Modifier.size(6.dp).background(if (point == null) Red else Mint, CircleShape))
                Text(if (point == null) L(locale, "مطلوب", "REQUIS") else L(locale, "تم التحديد", "DÉFINI"), color = if (point == null) Red else Mint, fontSize = 8.sp, fontWeight = FontWeight.Bold)
            }
        }

        Box(Modifier.fillMaxWidth().height(151.dp).clip(fieldShape).background(Color(0xFF063F31))) {
            Canvas(Modifier.fillMaxSize().pointerInput(locale) {
                detectTapGestures { tap ->
                    onPoint(
                        (tap.x / size.width * 100f).coerceIn(0f, 100f),
                        (tap.y / size.height * 100f).coerceIn(0f, 100f)
                    )
                }
            }) {
                val stripe = Color(0xFF1C7657).copy(alpha = .20f)
                val marking = Color.White.copy(alpha = .66f)
                drawRect(brush = Brush.linearGradient(listOf(Color(0xFF0B6549), Color(0xFF064333), Color(0xFF07513B))), size = size)
                for (lane in 0..5) {
                    if (lane % 2 == 0) drawRect(
                        color = stripe,
                        topLeft = Offset(size.width * lane / 6f, 0f),
                        size = Size(size.width / 6f, size.height)
                    )
                }
                val inset = 7.dp.toPx()
                val left = inset
                val right = size.width - inset
                val top = inset
                val bottom = size.height - inset
                val centerY = size.height / 2f
                drawRect(color = marking, topLeft = Offset(left, top), size = Size(right - left, bottom - top), style = androidx.compose.ui.graphics.drawscope.Stroke(1.2.dp.toPx()))
                drawLine(marking, Offset(size.width / 2f, top), Offset(size.width / 2f, bottom), 1.1.dp.toPx())
                drawCircle(marking, size.height * .19f, Offset(size.width / 2f, centerY), style = androidx.compose.ui.graphics.drawscope.Stroke(1.1.dp.toPx()))
                drawCircle(Mint.copy(alpha = .75f), 1.8.dp.toPx(), Offset(size.width / 2f, centerY))

                // The xG model treats the opponent goal as x=100, y=50; keep
                // this visual attack direction aligned with the saved values.
                val boxLeft = right - size.width * .19f
                val sixLeft = right - size.width * .075f
                drawRect(color = marking, topLeft = Offset(boxLeft, size.height * .19f), size = Size(right - boxLeft, size.height * .62f), style = androidx.compose.ui.graphics.drawscope.Stroke(1.1.dp.toPx()))
                drawRect(color = marking, topLeft = Offset(sixLeft, size.height * .36f), size = Size(right - sixLeft, size.height * .28f), style = androidx.compose.ui.graphics.drawscope.Stroke(1.1.dp.toPx()))
                drawCircle(marking, 1.8.dp.toPx(), Offset(right - size.width * .13f, centerY))
                drawRect(color = Color.White.copy(alpha = .82f), topLeft = Offset(right - 1.dp.toPx(), centerY - size.height * .13f), size = Size(5.dp.toPx(), size.height * .26f), style = androidx.compose.ui.graphics.drawscope.Stroke(1.4.dp.toPx()))

                point?.let { (x, y) ->
                    val marker = Offset(size.width * x / 100f, size.height * y / 100f)
                    drawCircle(Color.White.copy(alpha = .23f), 15.dp.toPx() * markerScale, marker)
                    drawCircle(Color.White, 10.dp.toPx() * markerScale, marker)
                    drawCircle(Red, 7.5.dp.toPx() * markerScale, marker)
                    drawCircle(Color.White, 2.dp.toPx(), marker)
                }
            }
            Row(Modifier.align(Alignment.TopStart).padding(8.dp).clip(CircleShape).background(Color.Black.copy(alpha = .32f)).padding(horizontal = 8.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(IconlyIcons.ArrowRight, contentDescription = null, tint = Mint, modifier = Modifier.size(12.dp))
                Text(L(locale, "اتجاه الهجوم", "Attaque"), color = Color.White.copy(alpha = .9f), fontSize = 8.sp, fontWeight = FontWeight.Bold)
            }
            Text(L(locale, "مرمى الخصم", "BUT ADVERSE"), color = Color.White.copy(alpha = .9f), fontSize = 7.sp, fontWeight = FontWeight.Bold, modifier = Modifier.align(Alignment.CenterEnd).padding(end = 3.dp).graphicsLayer { rotationZ = -90f })
            if (point == null) {
                Text(L(locale, "المس لتحديد الموقع", "Touchez pour placer le tir"), color = Color.White.copy(alpha = .85f), fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 8.dp).clip(CircleShape).background(Color.Black.copy(alpha = .34f)).padding(horizontal = 10.dp, vertical = 5.dp))
            }
        }

        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            if (point != null) {
                Text("x ${point.first.toInt()}%   ·   y ${point.second.toInt()}%", color = Muted, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
                Text(L(locale, "مسح النقطة", "Effacer"), color = Red, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(CircleShape).clickable(onClick = onClear).padding(horizontal = 8.dp, vertical = 5.dp))
            } else {
                Text(L(locale, "الهجوم نحو المرمى الظاهر يمين الملعب", "Attaque vers le but à droite"), color = Muted, fontSize = 8.sp)
                Text("xG", color = Mint, fontSize = 10.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

private fun bodyPartLabel(value: String, locale: String) = when(value) { "RIGHT_FOOT" -> L(locale, "القدم اليمنى", "Pied droit"); "LEFT_FOOT" -> L(locale, "القدم اليسرى", "Pied gauche"); "HEAD" -> L(locale, "الرأس", "Tête"); else -> L(locale, "أخرى", "Autre") }
private fun situationLabel(value: String, locale: String) = when(value) { "FREE_KICK" -> L(locale, "ركلة حرة", "Coup franc"); "CORNER" -> L(locale, "ركنية", "Corner"); "OTHER" -> L(locale, "أخرى", "Autre"); else -> L(locale, "لعب مفتوح", "Jeu ouvert") }
private fun outcomeLabel(value: String, locale: String) = when(value) { "OFF_TARGET" -> L(locale, "خارج المرمى", "Hors cadre"); "BLOCKED" -> L(locale, "مصدودة", "Contrée"); "WOODWORK" -> L(locale, "القائم أو العارضة", "Poteau / barre"); else -> L(locale, "تصدى لها الحارس", "Arrêtée") }

@Composable
private fun LegacyMatchCard(
    match: NativeMatch,
    saving: Boolean,
    locale: String,
    onUpdate: (NativeMatch, Int, Int, String?) -> Unit,
    onAddGoal: (NativeMatch, Boolean, String?, String?, Int) -> Unit
) {
    var expanded by remember(match.id) { mutableStateOf(false) }
    var clubScore by remember(match.id, match.clubScore) { mutableStateOf(match.clubScore ?: 0) }
    var opponentScore by remember(match.id, match.opponentScore) { mutableStateOf(match.opponentScore ?: 0) }
    var selectedPlayer by remember(match.id, match.players) { mutableStateOf(match.players.firstOrNull()?.id) }
    var playerMenu by remember { mutableStateOf(false) }
    var opponentName by remember { mutableStateOf("") }
    var minute by remember { mutableStateOf("0") }
    val selectedPlayerName = match.players.firstOrNull { it.id == selectedPlayer }?.let { if (locale == "fr" && it.nameFr.isNotBlank()) it.nameFr else it.name } ?: L(locale, "اختر لاعبًا", "Choisir un joueur")

    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(Brush.linearGradient(listOf(CardStart, CardEnd))).border(1.dp, GlassBorder, RoundedCornerShape(22.dp)).clickable { expanded = !expanded }.padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(match.opponent, color = AppText, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(5.dp))
                Text(match.competition, color = Muted, fontSize = 10.sp)
                Text(match.date.take(16).replace('T', ' '), color = Muted, fontSize = 10.sp)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(if (match.clubScore != null && match.opponentScore != null) "${match.clubScore} : ${match.opponentScore}" else "— : —", color = Red, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold)
                Text(match.statusLabel(locale), color = Muted, fontSize = 9.sp)
            }
        }
        if (match.events.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            Text(match.events.takeLast(3).joinToString("   ·   ") { "${it.minute}′ ${it.playerName ?: eventLabel(it.type, locale)}" }, color = Muted, fontSize = 10.sp, maxLines = 2)
        }

        if (expanded) {
            Spacer(Modifier.height(14.dp))
            Box(Modifier.fillMaxWidth().height(1.dp).background(Color.White.copy(alpha = .08f)))
            if (match.canUpdate) {
                Spacer(Modifier.height(13.dp))
                Text(L(locale, "تحديث النتيجة", "Modifier le score"), color = AppText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    ScoreStepper(L(locale, "فريق النادي", "Notre équipe"), clubScore, onChange = { next -> if (!saving && next >= 0) { clubScore = next; onUpdate(match, next, opponentScore, null) } })
                    Text(":", color = Muted, fontWeight = FontWeight.Bold)
                    ScoreStepper(L(locale, "الخصم", "Adversaire"), opponentScore, onChange = { next -> if (!saving && next >= 0) { opponentScore = next; onUpdate(match, clubScore, next, null) } })
                }
                if (match.status == "SCHEDULED") {
                    Text(L(locale, "بدء المباراة", "Démarrer le match"), color = Mint, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp).clip(CircleShape).background(Mint.copy(alpha = .11f)).clickable(enabled = !saving) { onUpdate(match, clubScore, opponentScore, "LIVE") }.padding(horizontal = 13.dp, vertical = 8.dp))
                } else if (match.status == "LIVE") {
                    Text(L(locale, "إنهاء المباراة", "Terminer le match"), color = Color(0xFFFFC36A), fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp).clip(CircleShape).background(Color(0xFFFFC36A).copy(alpha = .10f)).clickable(enabled = !saving) { onUpdate(match, clubScore, opponentScore, "FINISHED") }.padding(horizontal = 13.dp, vertical = 8.dp))
                }
            }

            if (match.canReport && (match.status == "LIVE" || match.status == "FINISHED")) {
                Spacer(Modifier.height(14.dp))
                Text(L(locale, "تسجيل هدف", "Ajouter un but"), color = AppText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(value = minute, onValueChange = { minute = it.filter(Char::isDigit).take(3) }, modifier = Modifier.width(84.dp), singleLine = true, label = { Text(L(locale, "الدقيقة", "Minute")) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                    if (match.players.isNotEmpty()) {
                        Box {
                            Text(selectedPlayerName, color = AppText, fontSize = 10.sp, maxLines = 1, modifier = Modifier.clip(RoundedCornerShape(10.dp)).background(Glass).border(1.dp, GlassBorder, RoundedCornerShape(10.dp)).clickable { playerMenu = true }.padding(horizontal = 10.dp, vertical = 12.dp))
                            ClubDropdownMenu(
                                expanded = playerMenu,
                                onDismissRequest = { playerMenu = false },
                                title = L(locale, "قائمة اللاعبين", "Joueurs disponibles"),
                                locale = locale,
                                selectedKey = selectedPlayer.orEmpty(),
                                options = match.players.map { player -> player.id to (player.number?.let { "$it · " }.orEmpty() + (if (locale == "fr" && player.nameFr.isNotBlank()) player.nameFr else player.name)) },
                                onSelected = { selectedPlayer = it; playerMenu = false }
                            )
                        }
                    }
                }
                OutlinedTextField(value = opponentName, onValueChange = { opponentName = it.take(120) }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text(L(locale, "اسم لاعب الخصم", "Nom du joueur adverse")) }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(L(locale, "هدف للنادي", "But pour le club"), color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f).clip(RoundedCornerShape(11.dp)).background(Red.copy(alpha = .75f)).clickable(enabled = !saving && selectedPlayer != null) { onAddGoal(match, true, selectedPlayer, null, minute.toIntOrNull() ?: 0) }.padding(horizontal = 8.dp, vertical = 11.dp), textAlign = TextAlign.Center)
                    Text(L(locale, "هدف للخصم", "But adverse"), color = AppText, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f).clip(RoundedCornerShape(11.dp)).background(Glass).border(1.dp, GlassBorder, RoundedCornerShape(11.dp)).clickable(enabled = !saving && opponentName.isNotBlank()) { onAddGoal(match, false, null, opponentName.trim(), minute.toIntOrNull() ?: 0); opponentName = "" }.padding(horizontal = 8.dp, vertical = 11.dp), textAlign = TextAlign.Center)
                }
            }
        }
    }
}

@Composable
private fun ScoreStepper(label: String, score: Int, onChange: (Int) -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, color = Muted, fontSize = 9.sp)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("−", color = AppText, fontSize = 19.sp, modifier = Modifier.clip(CircleShape).background(Glass).clickable { onChange(score - 1) }.padding(horizontal = 11.dp, vertical = 3.dp))
            Text(score.toString(), color = AppText, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 5.dp))
            Text("+", color = Red, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(CircleShape).clickable { onChange(score + 1) }.padding(horizontal = 11.dp, vertical = 3.dp))
        }
    }
}

private fun NativeMatch.statusLabel(locale: String): String = when (status) {
    "LIVE" -> L(locale, "مباشرة", "En direct")
    "FINISHED" -> L(locale, "انتهت", "Terminé")
    "POSTPONED" -> L(locale, "مؤجلة", "Reporté")
    "CANCELLED" -> L(locale, "ملغاة", "Annulé")
    else -> L(locale, "مجدولة", "Programmé")
}

private fun eventLabel(type: String, locale: String): String = when (type) {
    "GOAL", "PENALTY_GOAL" -> L(locale, "هدف", "But")
    "OWN_GOAL" -> L(locale, "هدف عكسي", "But contre son camp")
    "SHOT" -> L(locale, "تسديدة", "Tir")
    "PENALTY_MISSED" -> L(locale, "جزاء ضائع", "Penalty manqué")
    "ASSIST" -> L(locale, "تمريرة حاسمة", "Passe décisive")
    "YELLOW_CARD" -> L(locale, "إنذار", "Carton jaune")
    "RED_CARD" -> L(locale, "طرد", "Carton rouge")
    "SUBSTITUTION_IN" -> L(locale, "دخول لاعب", "Entrée")
    "SUBSTITUTION_OUT" -> L(locale, "خروج لاعب", "Sortie")
    else -> type
}

private fun categoryLabel(category: String, locale: String): String = when (category) {
    "SENIOR" -> L(locale, "الأكابر", "Seniors")
    "U20" -> L(locale, "أقل من 20", "U20")
    "U17" -> L(locale, "أقل من 17", "U17")
    "U15" -> L(locale, "أقل من 15", "U15")
    else -> category
}

/** Team names are admin-entered and often already end with their age group.
 * The card prints the category separately, so remove that suffix to avoid
 * showing labels such as “الأكابر · ESH — Seniors” twice. */
private fun teamNameWithoutCategory(teamName: String, category: String): String {
    val labels = when (category) {
        "SENIOR" -> listOf("فئة الأكابر", "الأكابر", "اكابر", "أكابر", "Seniors", "Senior")
        "U20" -> listOf("أقل من 20", "اقل من 20", "U20", "U-20", "moins de 20")
        "U17" -> listOf("أقل من 17", "اقل من 17", "U17", "U-17", "moins de 17")
        "U15" -> listOf("أقل من 15", "اقل من 15", "U15", "U-15", "moins de 15")
        else -> return teamName.trim()
    }
    val name = teamName.trim()
    val alternatives = labels.joinToString("|") { Regex.escape(it) }
    val cleaned = name
        .replace(Regex("(?iu)(?<![\\p{L}\\p{N}])(?:$alternatives)(?![\\p{L}\\p{N}])"), " ")
        .replace(Regex("[()\\[\\]{}·•|/–—-]+"), " ")
        .replace(Regex("\\s+"), " ")
        .trim()
    return cleaned
}

/** Keep native team pickers aligned with the platform's category order. */
private fun orderedNativeTeams(teams: List<NativeTeam>): List<NativeTeam> {
    val categoryOrder = mapOf("SENIOR" to 0, "U20" to 1, "U17" to 2, "U15" to 3)
    return teams.sortedBy { categoryOrder[it.category] ?: Int.MAX_VALUE }
}

@Composable
private fun MeetingCard(meeting: NativeMeeting, locale: String) {
    GlassCard {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Icon(IconlyIcons.Meeting, contentDescription = null, tint = Red, modifier = Modifier.size(23.dp))
            Spacer(Modifier.width(13.dp))
            Column {
                Text(meeting.title, color = AppText, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(5.dp))
                Text(meeting.date.take(16).replace('T', ' '), color = Muted, fontSize = 10.sp)
                meeting.location?.takeIf { it.isNotBlank() }?.let { Text(it, color = Muted, fontSize = 10.sp) }
            }
        }
    }
}

@Composable
private fun CalendarItemCard(item: NativeCalendarItem, clubLogoUrl: String?, locale: String) {
    val accent = when (item.type) {
        "MATCH" -> Red
        "TRAINING" -> Color(0xFF4DA3FF)
        "MEETING" -> Color(0xFFB18CFF)
        else -> Mint
    }
    val kind = when (item.type) {
        "MATCH" -> L(locale, "مباراة", "Match")
        "TRAINING" -> L(locale, "تدريب", "Entraînement")
        "MEETING" -> L(locale, "اجتماع", "Réunion")
        else -> L(locale, "موعد / وثيقة", "Rendez-vous / document")
    }
    GlassCard {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.width(4.dp).height(48.dp).clip(CircleShape).background(accent))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(kind, color = accent, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                if (item.type == "MATCH") {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        NativeRemoteImage(
                            clubLogoUrl?.takeIf { it.isNotBlank() } ?: "/branding/esh-logo-128.png",
                            Modifier.size(34.dp).clip(CircleShape),
                            fallback = { Image(painterResource(R.drawable.esh_logo), contentDescription = null, modifier = Modifier.fillMaxSize().padding(3.dp), contentScale = ContentScale.Fit) }
                        )
                        if (!item.opponentLogo.isNullOrBlank()) NativeRemoteImage(
                            item.opponentLogo,
                            Modifier.size(34.dp).clip(CircleShape),
                            fallback = { Icon(IconlyIcons.OpponentShield, contentDescription = L(locale, "شعار الخصم غير متوفر", "Logo adverse indisponible"), tint = Red, modifier = Modifier.size(28.dp)) }
                        ) else Icon(IconlyIcons.OpponentShield, contentDescription = L(locale, "شعار الخصم غير متوفر", "Logo adverse indisponible"), tint = Red, modifier = Modifier.size(28.dp))
                        Icon(
                            if (item.isHomeFixture == true) IconlyIcons.Home else IconlyIcons.Travel,
                            contentDescription = if (item.isHomeFixture == true) L(locale, "مضيف", "À domicile") else L(locale, "سفر", "Déplacement"),
                            tint = if (item.isHomeFixture == true) Mint else Red,
                            modifier = Modifier.size(21.dp)
                        )
                    }
                } else {
                    Text(item.title, color = AppText, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 2)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(item.startDateTime.take(16).replace('T', ' '), color = Muted, fontSize = 9.sp)
                    item.team?.takeIf { it.isNotBlank() }?.let { Text("· $it", color = Muted, fontSize = 9.sp, maxLines = 1) }
                }
                item.location?.takeIf { it.isNotBlank() }?.let { Text(it, color = Muted, fontSize = 9.sp, maxLines = 1) }
            }
            Icon(IconlyIcons.Calendar, contentDescription = null, tint = accent, modifier = Modifier.size(19.dp))
        }
    }
}

@Composable
private fun AlertCard(alert: NativeAlert, locale: String, onDelete: () -> Unit) {
    GlassCard {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Icon(IconlyIcons.Notification, contentDescription = null, tint = if (alert.read) Muted else Red, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(alert.title, color = AppText, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                alert.message?.let { Text(it, color = Muted, fontSize = 10.sp) }
            }
            IconButton(onClick = onDelete) {
                Icon(IconlyIcons.Close, contentDescription = L(locale, "حذف الإشعار", "Supprimer la notification"), tint = Muted, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun NativeCompetitionCard(competition: NativeCompetition, locale: String, onSave: (NativeCompetition, List<NativeStanding>) -> Unit) {
    var editing by remember(competition.id) { mutableStateOf(false) }
    var rows by remember(competition.id, competition.standings) { mutableStateOf(competition.standings) }
    val canManage = competition.canManage && competition.type == "LEAGUE"
    GlassCard {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(42.dp).clip(RoundedCornerShape(14.dp)).background(Color(0xFFFFC45D).copy(alpha = .14f)), contentAlignment = Alignment.Center) {
                if (!competition.logoUrl.isNullOrBlank()) NativeRemoteImage(competition.logoUrl!!, Modifier.size(28.dp).clip(CircleShape))
                else Icon(IconlyIcons.Star, contentDescription = null, tint = Color(0xFFFFC45D), modifier = Modifier.size(23.dp))
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(competition.name, color = AppText, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${competition.categoryLabel} · ${competition.seasonLabel}", color = Muted, fontSize = 10.sp)
            }
            if (canManage) TextButton(onClick = { editing = !editing }) { Text(if (editing) L(locale, "إلغاء", "Annuler") else L(locale, "تعديل", "Modifier"), color = Red, fontSize = 11.sp) }
        }
        Spacer(Modifier.height(12.dp))
        if (competition.type != "LEAGUE") {
            Text(L(locale, "هذه مسابقة كأس. تابع الرسم الهيكلي في المنصة.", "Cette compétition est une coupe. Consultez le tableau sur la plateforme."), color = Muted, fontSize = 11.sp)
        } else if (rows.isEmpty()) {
            Text(L(locale, "لم يتم إدخال ترتيب هذه المسابقة بعد.", "Le classement de cette compétition n’est pas encore renseigné."), color = Muted, fontSize = 11.sp)
        } else {
            rows.forEachIndexed { index, row ->
                if (editing) {
                    Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text((index + 1).toString(), color = if (row.isOurClub) Red else Muted, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(18.dp), textAlign = TextAlign.Center)
                        Text(row.teamName, color = if (row.isOurClub) Mint else AppText, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                        listOf(row.won, row.drawn, row.lost, row.goalsFor, row.goalsAgainst).forEachIndexed { field, value ->
                            OutlinedTextField(value = value.toString(), onValueChange = { raw ->
                                val next = raw.toIntOrNull()?.coerceAtLeast(0) ?: 0
                                rows = rows.mapIndexed { i, current ->
                                    if (i != index) current else when (field) {
                                        0 -> current.copy(won = next)
                                        1 -> current.copy(drawn = next)
                                        2 -> current.copy(lost = next)
                                        3 -> current.copy(goalsFor = next)
                                        else -> current.copy(goalsAgainst = next)
                                    }.let { updated -> updated.copy(played = updated.won + updated.drawn + updated.lost, points = updated.won * 3 + updated.drawn, goalDifference = updated.goalsFor - updated.goalsAgainst) }
                                }
                            }, singleLine = true, textStyle = androidx.compose.ui.text.TextStyle(fontSize = 10.sp, color = AppText, textAlign = TextAlign.Center), modifier = Modifier.width(31.dp).height(46.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Red, unfocusedBorderColor = GlassBorder, cursorColor = Red))
                        }
                        Text((row.won * 3 + row.drawn).toString(), color = AppText, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(25.dp), textAlign = TextAlign.Center)
                    }
                } else {
                    NativeStandingRow(row, locale)
                }
            }
            if (editing) {
                Spacer(Modifier.height(10.dp))
                ClubPrimaryButton(text = L(locale, "حفظ الترتيب", "Enregistrer le classement"), onClick = { onSave(competition, rows); editing = false }, modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp))
            }
        }
    }
}

@Composable
private fun NativeStandingRow(row: NativeStanding, locale: String) {
    val rankColor = when {
        row.isOurClub -> Red
        row.rank == 1 -> Color(0xFFD6A62E)
        row.rank == 2 -> Color(0xFF8B95A3)
        row.rank == 3 -> Color(0xFFB77A52)
        else -> Muted
    }
    val metrics = listOf(
        L(locale, "لعب", "MJ") to row.played,
        L(locale, "فاز", "G") to row.won,
        L(locale, "تعادل", "N") to row.drawn,
        L(locale, "خسر", "P") to row.lost,
        L(locale, "له", "BP") to row.goalsFor,
        L(locale, "عليه", "BC") to row.goalsAgainst,
        L(locale, "الفارق", "+/-") to row.goalDifference,
    )
    Column(
        Modifier.fillMaxWidth().padding(top = 7.dp).clip(RoundedCornerShape(15.dp))
            .background(if (row.isOurClub) Red.copy(alpha = if (nativeThemeIsLight) .07f else .12f) else Glass)
            .border(1.dp, if (row.isOurClub) Red.copy(alpha = .28f) else GlassBorder, RoundedCornerShape(15.dp))
            .padding(horizontal = 10.dp, vertical = 9.dp)
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(
                Modifier.size(25.dp).clip(CircleShape).background(rankColor.copy(alpha = if (row.rank <= 3 || row.isOurClub) .16f else .08f)),
                contentAlignment = Alignment.Center
            ) {
                Text(row.rank.toString(), color = rankColor, fontSize = 10.sp, fontWeight = FontWeight.Black)
            }
            Box(
                Modifier.size(29.dp).clip(CircleShape)
                    .background(if (row.isOurClub) Red.copy(alpha = .08f) else Glass)
                    .border(1.dp, if (row.isOurClub) Red.copy(alpha = .35f) else GlassBorder, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                if (!row.teamLogo.isNullOrBlank()) NativeRemoteImage(
                    row.teamLogo,
                    Modifier.size(23.dp).clip(CircleShape),
                    fallback = {
                        if (row.isOurClub) Image(painterResource(R.drawable.esh_logo), contentDescription = null, modifier = Modifier.fillMaxSize())
                        else Icon(IconlyIcons.OpponentShield, contentDescription = null, tint = Muted, modifier = Modifier.size(19.dp))
                    }
                )
                else Icon(IconlyIcons.OpponentShield, contentDescription = null, tint = if (row.isOurClub) Red else Muted, modifier = Modifier.size(19.dp))
            }
            Text(
                row.teamName,
                color = if (row.isOurClub) Red else AppText,
                fontSize = 11.sp,
                fontWeight = if (row.isOurClub) FontWeight.ExtraBold else FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            Column(
                Modifier.widthIn(min = 48.dp).clip(RoundedCornerShape(10.dp))
                    .background(if (row.isOurClub) Red else if (nativeThemeIsLight) Color(0xFFE9EDF0) else Color.White.copy(alpha = .07f))
                    .padding(horizontal = 9.dp, vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(row.points.toString(), color = if (row.isOurClub) Color.White else AppText, fontSize = 15.sp, fontWeight = FontWeight.Black, lineHeight = 17.sp)
                Text(L(locale, "نقاط", "Pts"), color = if (row.isOurClub) Color.White.copy(alpha = .88f) else Muted, fontSize = 7.sp, fontWeight = FontWeight.Bold, lineHeight = 9.sp)
            }
        }
        Row(Modifier.fillMaxWidth().padding(start = 33.dp, top = 8.dp), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            metrics.forEach { (label, value) ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(label, color = Muted, fontSize = 7.sp, maxLines = 1, textAlign = TextAlign.Center)
                    Text(value.toString(), color = if (label == L(locale, "الفارق", "+/-") && value > 0) Mint else AppText.copy(alpha = .82f), fontSize = 9.sp, fontWeight = FontWeight.Bold, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
                }
            }
        }
    }
}

@Composable
private fun GlassCard(content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(21.dp)).background(Brush.linearGradient(listOf(CardStart, CardEnd))).border(1.dp, GlassBorder, RoundedCornerShape(21.dp)).padding(16.dp)) { content() }
}

@Composable
private fun NativeImageThumbnail(uri: Uri, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val bitmap by produceState<ImageBitmap?>(null, uri) {
        val decoded = withContext(Dispatchers.IO) {
            runCatching {
                context.contentResolver.openInputStream(uri)?.use { stream ->
                    BitmapFactory.decodeStream(stream, null, BitmapFactory.Options().apply { inSampleSize = 4 })
                }
            }.getOrNull()
        }
        value = decoded?.asImageBitmap()
    }
    if (bitmap != null) Image(bitmap = bitmap!!, contentDescription = null, modifier = modifier, contentScale = ContentScale.Crop)
    else Box(modifier.background(Glass))
}

@Composable
private fun NativeRemoteImage(
    url: String,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Inside,
    fallback: @Composable () -> Unit = {}
) {
    val context = LocalContext.current
    val source = remember(url) { NativeApi.absolutePublicUrl(url) }
    val cacheKey = remember(source) { nativeImageCacheKey(source) }
    val request = remember(source, cacheKey) {
        ImageRequest.Builder(context)
            .data(source)
            .memoryCacheKey(cacheKey)
            .diskCacheKey(cacheKey)
            .memoryCachePolicy(CachePolicy.ENABLED)
            .diskCachePolicy(CachePolicy.ENABLED)
            .networkCachePolicy(CachePolicy.ENABLED)
            .crossfade(false)
            .build()
    }
    Box(modifier, contentAlignment = Alignment.Center) {
        fallback()
        AsyncImage(model = request, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = contentScale)
    }
}

/** Signed media URLs change query tokens on refresh; cache by the stable asset
 * path and non-auth query so a section switch can reuse an already loaded photo. */
private fun nativeImageCacheKey(source: String): String {
    if (source.startsWith("data:image/", ignoreCase = true)) return source
    val uri = Uri.parse(source)
    val transientParameters = setOf(
        "signature", "token", "expires", "sig", "se", "sp", "sv", "sr",
        "x-amz-algorithm", "x-amz-credential", "x-amz-date", "x-amz-expires",
        "x-amz-signedheaders", "x-amz-signature", "x-amz-security-token",
        "x-goog-algorithm", "x-goog-credential", "x-goog-date", "x-goog-expires",
        "x-goog-signedheaders", "x-goog-signature", "x-goog-security-token",
        "policy", "key-pair-id"
    )
    val stableUri = uri.buildUpon().clearQuery()
    uri.queryParameterNames.sorted().filterNot { it.lowercase() in transientParameters }.forEach { name ->
        uri.getQueryParameters(name).forEach { value -> stableUri.appendQueryParameter(name, value) }
    }
    return stableUri.build().toString()
}

private fun decodeNativeRemoteImage(source: String): ImageBitmap? = runCatching {
    if (source.startsWith("data:image/", ignoreCase = true)) {
        val payload = source.substringAfter(',', "")
        if (payload.isBlank()) return@runCatching null
        return@runCatching Base64.decode(payload, Base64.DEFAULT).let { bytes ->
            ByteArrayInputStream(bytes).use { BitmapFactory.decodeStream(it)?.asImageBitmap() }
        }
    }
    val normalizedSource = when {
        source.startsWith("//") -> "https:$source"
        else -> NativeApi.absolutePublicUrl(source)
    }
    val connection = URL(normalizedSource).openConnection() as java.net.HttpURLConnection
    connection.connectTimeout = 10_000
    connection.readTimeout = 15_000
    connection.setRequestProperty("Accept", "image/*")
    connection.setRequestProperty("User-Agent", "ESH-Field-Android")
    connection.setRequestProperty("Cache-Control", "no-cache")
    try {
        if (connection.responseCode !in 200..299) return@runCatching null
        connection.inputStream.use { BitmapFactory.decodeStream(it)?.asImageBitmap() }
    } finally { connection.disconnect() }
}.getOrNull()

@Composable
private fun NativeCreateDialog(type: String, teams: List<NativeTeam>, coaches: List<NativeCoach>, teamScopeRestricted: Boolean, locale: String, isSubmitting: Boolean, errorMessage: String?, onDismiss: () -> Unit, onSubmit: (org.json.JSONObject) -> Unit) {
    val context = LocalContext.current
    val orderedTeams = orderedNativeTeams(teams)
    var titleAr by remember(type) { mutableStateOf("") }
    var contentAr by remember(type) { mutableStateOf("") }
    var titleFr by remember(type) { mutableStateOf("") }
    var contentFr by remember(type) { mutableStateOf("") }
    var date by remember(type) { mutableStateOf(java.time.LocalDate.now().toString()) }
    var startTime by remember(type) { mutableStateOf("18:00") }
    var endTime by remember(type) { mutableStateOf("19:00") }
    var location by remember(type) { mutableStateOf("") }
    var category by remember(type) { mutableStateOf("") }
    var announcementPriority by remember(type) { mutableStateOf("NORMAL") }
    var notes by remember(type) { mutableStateOf("") }
    var teamId by remember(type, orderedTeams) { mutableStateOf(orderedTeams.firstOrNull()?.id.orEmpty()) }
    var coachId by remember(type) { mutableStateOf("") }
    var teamMenu by remember { mutableStateOf(false) }
    var contentLocale by remember(type) { mutableStateOf("ar") }
    var step by remember(type) { mutableIntStateOf(1) }
    val selectedImages = remember(type) { mutableStateListOf<Uri>() }
    val formScrollState = rememberScrollState()
    LaunchedEffect(step) { formScrollState.scrollTo(0) }
    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { images ->
        selectedImages.clear()
        selectedImages.addAll(images.distinct().take(10))
    }
    val stepCount = if (type == "news") 2 else if (type == "training" || type == "meeting") 3 else 1
    val validTimeRange = runCatching {
        val start = startTime.split(":").let { it[0].toInt() * 60 + it[1].toInt() }
        val end = endTime.split(":").let { it[0].toInt() * 60 + it[1].toInt() }
        startTime.matches(Regex("\\d{2}:\\d{2}")) && endTime.matches(Regex("\\d{2}:\\d{2}")) && end > start
    }.getOrDefault(false)
    val title = when (type) {
        "training" -> L(locale, "إضافة تدريب", "Nouvel entraînement")
        "meeting" -> L(locale, "إضافة اجتماع", "Nouvelle réunion")
        "announcement" -> L(locale, "إضافة إعلان", "Nouvelle annonce")
        else -> L(locale, "إضافة خبر", "Nouvelle actualité")
    }
    val canContinue = when {
        type == "news" && step == 1 -> titleAr.isNotBlank() && contentAr.isNotBlank() && titleFr.isNotBlank() && contentFr.isNotBlank()
        type == "news" -> true
        type == "training" && step == 1 -> teamId.isNotBlank() && coachId.isNotBlank()
        type == "training" && step == 2 -> date.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) && validTimeRange
        type == "training" -> teamId.isNotBlank()
        type == "meeting" && step == 1 -> teamId.isNotBlank() && titleAr.isNotBlank()
        type == "meeting" && step == 2 -> date.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) && validTimeRange
        type == "meeting" -> teamId.isNotBlank() && titleAr.isNotBlank()
        else -> titleAr.isNotBlank() && contentAr.isNotBlank() && titleFr.isNotBlank() && contentFr.isNotBlank() && !(type == "announcement" && teamScopeRestricted && teamId.isBlank())
    }
    val actionLabel = when {
        (type == "news" && step == 1) || ((type == "training" || type == "meeting") && step < 3) -> L(locale, "متابعة", "Continuer")
        type == "news" -> L(locale, "نشر الخبر", "Publier l’actualité")
        type == "training" -> L(locale, "نشر التدريب", "Publier la séance")
        type == "meeting" -> L(locale, "جدولة الاجتماع", "Planifier la réunion")
        else -> L(locale, "حفظ ونشر", "Enregistrer et publier")
    }
    AlertDialog(
        onDismissRequest = { if (!isSubmitting) onDismiss() },
        shape = RoundedCornerShape(22.dp),
        containerColor = Panel,
        titleContentColor = Color.White,
        textContentColor = Muted,
        title = {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(RedGlow).border(1.dp, Red.copy(alpha = .22f), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
                    Icon(if (type == "training") IconlyIcons.Activity else if (type == "meeting") IconlyIcons.Meeting else IconlyIcons.Paper, contentDescription = null, tint = Red, modifier = Modifier.size(22.dp))
                }
                Column(Modifier.weight(1f)) {
                    Text(title, color = AppText, fontWeight = FontWeight.Bold, fontFamily = CairoFamily, fontSize = 19.sp)
                    Text(when (type) { "training" -> L(locale, "نظّم الحصة وحدد موعدها", "Organisez la séance et son horaire"); "meeting" -> L(locale, "حدد اجتماعًا لفئتك وأرسل التنبيه", "Planifiez une réunion d’équipe et envoyez l’alerte"); else -> L(locale, "محتوى منسق للنشر على الموقع", "Contenu prêt à publier sur le site") }, color = Muted, fontFamily = CairoFamily, fontSize = 10.sp)
                }
            }
        },
        text = {
            Column(Modifier.animateContentSize().heightIn(max = 490.dp).verticalScroll(formScrollState), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (stepCount > 1) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        repeat(stepCount) { index ->
                            Box(Modifier.weight(1f).height(4.dp).clip(CircleShape).background(if (index < step) Red else GlassBorder))
                        }
                    }
                    Text(L(locale, "الخطوة $step من $stepCount", "Étape $step sur $stepCount"), color = Muted, fontFamily = CairoFamily, fontSize = 10.sp)
                }
                errorMessage?.let { message ->
                    Text(message, color = Red, fontFamily = CairoFamily, fontSize = 10.sp, lineHeight = 15.sp, modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(11.dp)).background(RedGlow).padding(10.dp))
                }
                if (type == "training" || type == "meeting") {
                    if (type == "meeting" && step == 1) OutlinedTextField(value = titleAr, onValueChange = { titleAr = it.take(160) }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text(L(locale, "عنوان الاجتماع", "Titre de la réunion")) }, shape = RoundedCornerShape(13.dp), colors = loginFieldColors())
                    val availableCoaches = coaches.filter { teamId in it.teamIds }
                    if ((type == "meeting" && step == 1) || (type == "training" && step == 1)) Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(Glass).border(1.dp, GlassBorder, RoundedCornerShape(17.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(IconlyIcons.People, contentDescription = null, tint = Red, modifier = Modifier.size(18.dp))
                            Column {
                                Text(if (type == "meeting") L(locale, "الفئة المستهدفة", "Équipe concernée") else L(locale, "الفئة والجهاز الفني", "Catégorie et encadrement"), color = AppText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                Text(if (type == "meeting") L(locale, "سيصل التنبيه لمستخدمي هذه الفئة", "Les membres de cette équipe recevront une alerte") else L(locale, "اختر الفريق والمدرب المسؤول", "Choisissez l’équipe et l’entraîneur"), color = Muted, fontSize = 9.sp)
                            }
                        }
                        if (teams.isEmpty()) Text(L(locale, "لا توجد فئات متاحة لحسابك.", "Aucune équipe n’est accessible à ce compte."), color = Red, fontSize = 12.sp)
                        else NativeDropdownField(
                            label = L(locale, "الفئة", "Catégorie"),
                            value = orderedTeams.firstOrNull { it.id == teamId }?.let { categoryLabel(it.category, locale) }.orEmpty(),
                            placeholder = L(locale, "اختر الفئة", "Choisir une catégorie"),
                            options = orderedTeams.map { it.id to categoryLabel(it.category, locale) },
                            onSelected = { teamId = it; coachId = "" }
                        )
                        if (type == "training") NativeDropdownField(
                            label = L(locale, "المدرب", "Entraîneur"),
                            value = availableCoaches.firstOrNull { it.id == coachId }?.name.orEmpty(),
                            placeholder = if (availableCoaches.isEmpty()) L(locale, "لا يوجد مدرب مسجل لهذه الفئة", "Aucun entraîneur pour cette catégorie") else L(locale, "اختر المدرب", "Choisir un entraîneur"),
                            options = availableCoaches.map { it.id to it.name },
                            onSelected = { coachId = it }
                        )
                    }
                    if ((type == "meeting" && step == 2) || (type == "training" && step == 2)) Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(Glass).border(1.dp, GlassBorder, RoundedCornerShape(17.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(if (type == "meeting") IconlyIcons.Meeting else IconlyIcons.Calendar, contentDescription = null, tint = Red, modifier = Modifier.size(18.dp))
                            Column {
                                Text(if (type == "meeting") L(locale, "موعد الاجتماع", "Horaire de la réunion") else L(locale, "موعد التدريب", "Horaire de la séance"), color = AppText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                Text(L(locale, "حدد التاريخ ووقت البداية والنهاية", "Date, heure de début et de fin"), color = Muted, fontSize = 9.sp)
                            }
                        }
                        OutlinedTextField(value = date, onValueChange = {}, readOnly = true, modifier = Modifier.fillMaxWidth().clickable {
                            val parts = date.split("-").mapNotNull { it.toIntOrNull() }
                            val calendar = Calendar.getInstance()
                            DatePickerDialog(context, { _, year, month, day -> date = "%04d-%02d-%02d".format(year, month + 1, day) }, parts.getOrElse(0) { calendar.get(Calendar.YEAR) }, (parts.getOrElse(1) { calendar.get(Calendar.MONTH) + 1 } - 1).coerceIn(0, 11), parts.getOrElse(2) { calendar.get(Calendar.DAY_OF_MONTH) }).show()
                        }, singleLine = true, label = { Text(if (type == "meeting") L(locale, "موعد الاجتماع · اختر التاريخ", "Date de la réunion") else L(locale, "موعد التدريب · اختر التاريخ", "Date de la séance")) }, shape = RoundedCornerShape(13.dp), colors = loginFieldColors())
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(value = startTime, onValueChange = {}, readOnly = true, modifier = Modifier.weight(1f).clickable { TimePickerDialog(context, { _, hour, minute -> startTime = "%02d:%02d".format(hour, minute) }, startTime.take(2).toIntOrNull() ?: 18, startTime.takeLast(2).toIntOrNull() ?: 0, true).show() }, singleLine = true, label = { Text(L(locale, "وقت البداية", "Début")) }, shape = RoundedCornerShape(13.dp), colors = loginFieldColors())
                            OutlinedTextField(value = endTime, onValueChange = {}, readOnly = true, modifier = Modifier.weight(1f).clickable { TimePickerDialog(context, { _, hour, minute -> endTime = "%02d:%02d".format(hour, minute) }, endTime.take(2).toIntOrNull() ?: 19, endTime.takeLast(2).toIntOrNull() ?: 0, true).show() }, singleLine = true, label = { Text(L(locale, "وقت النهاية", "Fin")) }, shape = RoundedCornerShape(13.dp), colors = loginFieldColors())
                        }
                    }
                    if (step == 3 && (type == "meeting" || type == "training")) Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(Glass).border(1.dp, GlassBorder, RoundedCornerShape(17.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(value = location, onValueChange = { location = it.take(160) }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text(L(locale, "المكان · اختياري", "Lieu · facultatif")) }, shape = RoundedCornerShape(13.dp), colors = loginFieldColors())
                        OutlinedTextField(value = notes, onValueChange = { notes = it.take(2000) }, modifier = Modifier.fillMaxWidth().height(92.dp), label = { Text(if (type == "meeting") L(locale, "جدول الأعمال / ملاحظات", "Ordre du jour / notes") else L(locale, "ملاحظات للمدربين واللاعبين", "Notes pour l’équipe")) }, shape = RoundedCornerShape(13.dp), colors = loginFieldColors())
                    }
                } else {
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(RedGlow).border(1.dp, Red.copy(alpha = .20f), RoundedCornerShape(12.dp)).padding(11.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        Icon(IconlyIcons.Paper, contentDescription = null, tint = Red, modifier = Modifier.size(17.dp))
                        Text(L(locale, "سيظهر المحتوى بعد نشره على المنصة والموقع العام.", "Le contenu sera publié sur la plateforme et le site public."), color = AppText, fontSize = 10.sp, lineHeight = 15.sp)
                    }
                    if (type == "announcement" && teamScopeRestricted && teams.isNotEmpty()) Box {
                        OutlinedTextField(value = orderedTeams.firstOrNull { it.id == teamId }?.let { "${it.name} · ${categoryLabel(it.category, locale)}" }.orEmpty(), onValueChange = {}, readOnly = true, modifier = Modifier.fillMaxWidth().clickable { teamMenu = true }, label = { Text(L(locale, "الفريق / الفئة", "Équipe / catégorie")) }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                        ClubDropdownMenu(
                            expanded = teamMenu,
                            onDismissRequest = { teamMenu = false },
                            title = L(locale, "اختر الفريق", "Choisir une équipe"),
                            locale = locale,
                            selectedKey = teamId,
                            options = orderedTeams.map { it.id to "${it.name} · ${categoryLabel(it.category, locale)}" },
                            onSelected = { teamId = it; teamMenu = false }
                        )
                    }
                    if (type != "news" || step == 1) {
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Glass).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf("ar" to L(locale, "العربية", "Arabe"), "fr" to "Français").forEach { (code, label) ->
                            val activeLanguage = contentLocale == code
                            Text(label, color = if (activeLanguage) Color.White else Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center, modifier = Modifier.weight(1f).clip(RoundedCornerShape(10.dp))
                                    .background(if (activeLanguage) Red else Color.Transparent).clickable { contentLocale = code }.padding(vertical = 10.dp))
                        }
                    }
                    AnimatedContent(targetState = contentLocale, label = "news-language-fields") { language ->
                        val arabic = language == "ar"
                        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp)).background(Glass).border(1.dp, if (arabic) Red.copy(alpha = .28f) else GlassBorder, RoundedCornerShape(15.dp)).padding(11.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(if (arabic) "العربية" else "Français", color = AppText, fontSize = 13.sp, fontWeight = FontWeight.Bold, fontFamily = CairoFamily)
                                Text(if (arabic) L(locale, "النسخة الأساسية", "Version principale") else L(locale, "النسخة الفرنسية", "Version française"), color = if (arabic) Red else Muted, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(CircleShape).background(if (arabic) Red.copy(alpha = .10f) else Panel).padding(horizontal = 9.dp, vertical = 5.dp))
                            }
                            OutlinedTextField(value = if (arabic) titleAr else titleFr, onValueChange = { if (arabic) titleAr = it.take(200) else titleFr = it.take(200) }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text(if (arabic) L(locale, "عنوان الخبر", "Titre de l’actualité") else "Titre de l’actualité") }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                            OutlinedTextField(value = if (arabic) contentAr else contentFr, onValueChange = { if (arabic) contentAr = it.take(20000) else contentFr = it.take(20000) }, modifier = Modifier.fillMaxWidth().height(132.dp), label = { Text(if (arabic) L(locale, "نص الخبر", "Texte de l’actualité") else "Texte de l’actualité") }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                        }
                    }
                    if (type == "news") OutlinedTextField(value = category, onValueChange = { category = it.take(80) }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text(L(locale, "التصنيف · اختياري", "Catégorie · facultative")) }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                    if (type == "announcement") {
                        val priorityOptions = listOf(
                            "LOW" to L(locale, "منخفضة", "Basse"),
                            "NORMAL" to L(locale, "عادية", "Normale"),
                            "HIGH" to L(locale, "مرتفعة", "Haute"),
                            "URGENT" to L(locale, "عاجلة", "Urgente")
                        )
                        val priorityColor = when (announcementPriority) {
                            "LOW" -> Color(0xFF94A3B8)
                            "HIGH" -> Color(0xFFF59E0B)
                            "URGENT" -> Color(0xFFEF4444)
                            else -> Color(0xFF38BDF8)
                        }
                        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(Glass).border(1.dp, GlassBorder, RoundedCornerShape(17.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Box(Modifier.size(9.dp).background(priorityColor, CircleShape))
                                Column {
                                    Text(L(locale, "أولوية الإعلان", "Priorité de l’annonce"), color = AppText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    Text(L(locale, "تظهر الأولوية في المنصة والموقع حسب درجتها", "La priorité sera visible sur la plateforme et le site"), color = Muted, fontSize = 9.sp)
                                }
                            }
                            NativeDropdownField(
                                label = L(locale, "درجة الأولوية", "Niveau de priorité"),
                                value = priorityOptions.first { it.first == announcementPriority }.second,
                                placeholder = L(locale, "اختر الأولوية", "Choisir la priorité"),
                                options = priorityOptions,
                                onSelected = { announcementPriority = it }
                            )
                        }
                    }
                    }
                    if (type == "news" && step == 2) {
                        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(Glass).border(1.dp, GlassBorder, RoundedCornerShape(17.dp)).padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                                Icon(IconlyIcons.Camera, contentDescription = null, tint = Mint, modifier = Modifier.size(20.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(L(locale, "صور الخبر", "Photos de l’actualité"), color = AppText, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                    Text(L(locale, "اختر حتى 10 صور من هاتفك · JPG أو PNG أو WebP · 4 MB للصورة", "Jusqu’à 10 images · JPG, PNG ou WebP · 4 Mo par image"), color = Muted, fontSize = 9.sp, lineHeight = 14.sp)
                                }
                            }
                            ClubPrimaryButton(text = L(locale, "اختيار الصور من الهاتف", "Choisir des photos"), onClick = { imagePicker.launch("image/*") }, modifier = Modifier.fillMaxWidth(), enabled = !isSubmitting)
                            if (selectedImages.isNotEmpty()) {
                                Text(L(locale, "${selectedImages.size} صور محددة · الصورة الأولى هي الغلاف", "${selectedImages.size} images · la première sera la couverture"), color = Mint, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                                    selectedImages.forEachIndexed { index, uri ->
                                        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Panel).padding(8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                                            NativeImageThumbnail(uri, Modifier.size(42.dp).clip(RoundedCornerShape(9.dp)))
                                            Text(L(locale, "صورة ${index + 1}", "Image ${index + 1}"), color = AppText, fontSize = 11.sp, modifier = Modifier.weight(1f))
                                            TextButton(onClick = { selectedImages.remove(uri) }, enabled = !isSubmitting) { Text(L(locale, "حذف", "Retirer"), color = Red, fontSize = 10.sp) }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            ClubPrimaryButton(
                text = actionLabel,
                enabled = canContinue && !isSubmitting,
                loading = isSubmitting,
                modifier = Modifier.width(190.dp),
                onClick = {
                if ((type == "news" && step == 1) || ((type == "training" || type == "meeting") && step < 3)) {
                    step += 1
                    return@ClubPrimaryButton
                }
                val payload = org.json.JSONObject().put("type", type)
                if (type == "training") payload.put("teamId", teamId).put("coachId", coachId).put("date", date).put("startTime", startTime).put("endTime", endTime).put("location", location).put("notes", notes)
                else if (type == "meeting") payload.put("teamId", teamId).put("title", titleAr.trim()).put("date", date).put("startTime", startTime).put("endTime", endTime).put("location", location).put("description", notes)
                else {
                    payload.put("titleAr", titleAr.trim()).put("contentAr", contentAr.trim()).put("titleFr", titleFr.trim()).put("contentFr", contentFr.trim())
                    if (type == "announcement") payload.put("priority", announcementPriority).put("teamId", if (teamScopeRestricted) teamId else "") else {
                        payload.put("category", category.trim())
                        val imageUris = org.json.JSONArray()
                        selectedImages.forEach { imageUris.put(it.toString()) }
                        payload.put("imageUris", imageUris)
                    }
                }
                onSubmit(payload)
            })
        },
        dismissButton = {
            TextButton(enabled = !isSubmitting, onClick = { if (step > 1 && (type == "news" || type == "training" || type == "meeting")) step -= 1 else onDismiss() }) {
                Text(if (step > 1 && (type == "news" || type == "training" || type == "meeting")) L(locale, "السابق", "Précédent") else L(locale, "إلغاء", "Annuler"), color = Muted, fontFamily = CairoFamily)
            }
        }
    )
}

@Composable
private fun NativeDropdownField(
    label: String,
    value: String,
    placeholder: String,
    options: List<Pair<String, String>>,
    onSelected: (String) -> Unit
) {
    var expanded by remember(label, options) { mutableStateOf(false) }
    Box(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 58.dp).clip(RoundedCornerShape(13.dp))
                .background(Glass).border(1.dp, if (expanded) Red else GlassBorder, RoundedCornerShape(13.dp))
                .clickable(enabled = options.isNotEmpty()) { expanded = true }.padding(horizontal = 14.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(Modifier.weight(1f)) {
                Text(label, color = Red, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(3.dp))
                Text(value.ifBlank { placeholder }, color = if (value.isBlank()) Muted else AppText, fontSize = 13.sp, maxLines = 1)
            }
            val arrowRotation by animateFloatAsState(if (expanded) 180f else 0f, label = "dropdown-arrow")
            Icon(IconlyIcons.ArrowDown, contentDescription = label, tint = if (expanded) Mint else Red, modifier = Modifier.graphicsLayer { rotationZ = arrowRotation })
        }
        ClubDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            title = label,
            locale = if (LocalLayoutDirection.current == LayoutDirection.Rtl) "ar" else "fr",
            selectedKey = options.firstOrNull { it.second == value }?.first,
            options = options,
            onSelected = { onSelected(it); expanded = false }
        )
    }
}

@Composable
private fun ClubDropdownMenu(
    expanded: Boolean,
    onDismissRequest: () -> Unit,
    title: String,
    locale: String,
    selectedKey: String?,
    options: List<Pair<String, String>>,
    onSelected: (String) -> Unit
) {
    val shape = RoundedCornerShape(19.dp)
    DropdownMenu(
        expanded = expanded,
        onDismissRequest = onDismissRequest,
        modifier = Modifier.widthIn(min = 218.dp, max = 330.dp).heightIn(max = 340.dp),
        shape = shape,
        containerColor = Panel,
        tonalElevation = 0.dp,
        shadowElevation = 12.dp,
        border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
    ) {
        Column(Modifier.padding(horizontal = 7.dp, vertical = 8.dp)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Text(title, color = Muted, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(options.size.toString(), color = Red, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
            Box(Modifier.fillMaxWidth().padding(horizontal = 8.dp).height(1.dp).background(GlassBorder))
            if (options.isEmpty()) {
                Text(L(locale, "لا توجد خيارات متاحة", "Aucune option disponible"), color = Muted, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 12.dp, vertical = 14.dp))
            } else options.forEach { (key, label) ->
                val selected = key == selectedKey
                val itemShape = RoundedCornerShape(12.dp)
                Row(
                    Modifier.fillMaxWidth().padding(top = 3.dp).clip(itemShape)
                        .background(if (selected) RedGlow else Color.Transparent)
                        .clickable { onSelected(key) }.padding(horizontal = 10.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(9.dp)
                ) {
                    Box(Modifier.size(7.dp).background(if (selected) Red else GlassBorder, CircleShape))
                    Text(label, color = if (selected) AppText else AppText.copy(alpha = .88f), fontFamily = CairoFamily, fontSize = 12.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, modifier = Modifier.weight(1f), maxLines = 2)
                    if (selected) Icon(IconlyIcons.Check, contentDescription = null, tint = Red, modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}

@Composable
private fun NativeLoginScreen(connectionError: String?, loading: Boolean, locale: String, lightMode: Boolean, onToggleTheme: () -> Unit, onToggleLocale: () -> Unit, onLogin: (String, String, Boolean) -> Unit) {
    val context = LocalContext.current
    val loginPreferences = remember { context.getSharedPreferences("esh_native_ui", Context.MODE_PRIVATE) }
    var rememberMe by remember { mutableStateOf(loginPreferences.getBoolean("remember_login", false)) }
    var email by remember { mutableStateOf(if (rememberMe) loginPreferences.getString("remembered_email", "").orEmpty() else "") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    val emailFocus = remember { FocusRequester() }
    val passwordFocus = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    val rtl = locale == "ar"

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars).verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 20.dp, vertical = 14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.clip(RoundedCornerShape(13.dp)).background(Glass).border(1.dp, GlassBorder, RoundedCornerShape(13.dp)).clickable(enabled = !loading, onClick = onToggleLocale).padding(horizontal = 12.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    Icon(IconlyIcons.Language, contentDescription = null, tint = Muted, modifier = Modifier.size(16.dp))
                    Text(if (rtl) "FR" else "عربي", color = AppText, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(8.dp))
                HeaderIconButton(if (lightMode) IconlyIcons.Moon else IconlyIcons.Sun, L(locale, "تبديل المظهر", "Changer le thème"), tint = AppText, onClick = onToggleTheme)
            }
            Spacer(Modifier.height(12.dp))
            Box(Modifier.size(72.dp).clip(RoundedCornerShape(23.dp)).background(Panel).border(1.dp, GlassBorder, RoundedCornerShape(23.dp)), contentAlignment = Alignment.Center) {
                Image(painterResource(R.drawable.esh_logo), contentDescription = L(locale, "شعار نادي أمل سيدي حسني", "Logo d’Espoir Sidi Hosni"), modifier = Modifier.size(55.dp))
            }
            Spacer(Modifier.height(10.dp))
            Text("E SIDI HOSNI", color = AppText, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.8.sp)
            Text(L(locale, "بوابة الإدارة الميدانية", "Espace d’administration terrain"), color = Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
            Spacer(Modifier.height(18.dp))
            Column(Modifier.fillMaxWidth().widthIn(max = 520.dp).clip(RoundedCornerShape(22.dp)).background(Panel).border(1.dp, GlassBorder, RoundedCornerShape(22.dp)).padding(horizontal = 20.dp, vertical = 20.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.weight(1f), horizontalAlignment = if (rtl) Alignment.End else Alignment.Start) {
                        Text(L(locale, "مرحبًا بك في النادي", "Bienvenue au club"), color = AppText, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
                        Text(L(locale, "سجّل الدخول بحسابك للمتابعة", "Connectez-vous pour continuer"), color = Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
                    }
                    Box(Modifier.size(4.dp, 36.dp).clip(CircleShape).background(Red))
                }
                Spacer(Modifier.height(18.dp))
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    OutlinedTextField(value = email, onValueChange = { value -> email = value; if (rememberMe) loginPreferences.edit().putString("remembered_email", value.trim()).apply() }, modifier = Modifier.fillMaxWidth().focusRequester(emailFocus), readOnly = loading, singleLine = true, label = { Text(L(locale, "البريد الإلكتروني", "Adresse e-mail")) }, leadingIcon = { Icon(IconlyIcons.Mail, contentDescription = null, tint = Muted, modifier = Modifier.size(18.dp)) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next, capitalization = KeyboardCapitalization.None, autoCorrectEnabled = false), keyboardActions = KeyboardActions(onNext = { passwordFocus.requestFocus() }), shape = RoundedCornerShape(14.dp), colors = loginFieldColors())
                }
                Spacer(Modifier.height(12.dp))
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    OutlinedTextField(value = password, onValueChange = { password = it }, modifier = Modifier.fillMaxWidth().focusRequester(passwordFocus), readOnly = loading, singleLine = true, label = { Text(L(locale, "كلمة المرور", "Mot de passe")) }, leadingIcon = { Icon(IconlyIcons.Lock, contentDescription = null, tint = Muted, modifier = Modifier.size(18.dp)) }, visualTransformation = if (passwordVisible) androidx.compose.ui.text.input.VisualTransformation.None else PasswordVisualTransformation(), trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }, enabled = !loading) {
                            Icon(iconRes = if (passwordVisible) IconlyIcons.Hide else IconlyIcons.Show, contentDescription = if (passwordVisible) L(locale, "إخفاء كلمة المرور", "Masquer le mot de passe") else L(locale, "إظهار كلمة المرور", "Afficher le mot de passe"), tint = if (passwordVisible) Red else Muted)
                        }
                    }, keyboardOptions = KeyboardOptions(keyboardType = if (passwordVisible) KeyboardType.Text else KeyboardType.Password, imeAction = ImeAction.Done), keyboardActions = KeyboardActions(onDone = { keyboard?.hide(); if (email.isNotBlank() && password.isNotBlank() && !loading) onLogin(email.trim(), password, rememberMe) }), shape = RoundedCornerShape(14.dp), colors = loginFieldColors())
                }
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(enabled = !loading) { rememberMe = !rememberMe; loginPreferences.edit().putBoolean("remember_login", rememberMe).apply(); if (rememberMe) loginPreferences.edit().putString("remembered_email", email.trim()).apply() else loginPreferences.edit().remove("remembered_email").apply() }.padding(horizontal = 2.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = rememberMe, onCheckedChange = { checked -> rememberMe = checked; loginPreferences.edit().putBoolean("remember_login", checked).apply(); if (checked) loginPreferences.edit().putString("remembered_email", email.trim()).apply() else loginPreferences.edit().remove("remembered_email").apply() }, enabled = !loading, colors = CheckboxDefaults.colors(checkedColor = Red, uncheckedColor = Muted, checkmarkColor = Color.White))
                    Spacer(Modifier.width(7.dp))
                    Text(L(locale, "تذكّرني على هذا الجهاز", "Se souvenir de moi sur cet appareil"), color = AppText, fontSize = 11.sp)
                }
                AnimatedVisibility(visible = connectionError != null) {
                    connectionError?.let {
                        Row(Modifier.fillMaxWidth().padding(top = 8.dp).clip(RoundedCornerShape(12.dp)).background(RedGlow).border(1.dp, Red.copy(alpha = .28f), RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(IconlyIcons.Close, contentDescription = null, tint = Red, modifier = Modifier.size(17.dp))
                            Text(it, color = if (lightMode) Color(0xFF9F2525) else Color(0xFFFFA3A3), fontSize = 11.sp, lineHeight = 17.sp)
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
                ClubPrimaryButton(text = L(locale, "تسجيل الدخول", "Se connecter"), onClick = { keyboard?.hide(); onLogin(email.trim(), password, rememberMe) }, enabled = email.isNotBlank() && password.isNotBlank() && !loading, loading = loading, modifier = Modifier.fillMaxWidth().height(52.dp))
                Text(L(locale, "تسجيل آمن ومشفّر", "Connexion sécurisée et chiffrée"), color = Muted, fontSize = 10.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 12.dp))
            }
            Spacer(Modifier.height(18.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(6.dp).background(Red, CircleShape))
                Spacer(Modifier.width(7.dp))
                Text(L(locale, "إدارة المباريات والاجتماعات بأمان", "Gérez matchs et réunions en toute sécurité"), color = Muted, fontSize = 10.sp)
            }
        }
    }
}
@Composable
private fun loginFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = AppText,
    unfocusedTextColor = AppText,
    focusedContainerColor = Panel,
    unfocusedContainerColor = Glass,
        focusedBorderColor = Red,
    unfocusedBorderColor = GlassBorder,
    focusedLabelColor = Red,
    unfocusedLabelColor = Muted,
    cursorColor = Red
)

@Composable
private fun EmptyNativeSection(icon: Int, title: String, body: String, badge: String, locale: String) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Brush.linearGradient(listOf(Glass, Panel))).border(1.dp, Color.White.copy(alpha = .09f), RoundedCornerShape(24.dp)).padding(23.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(62.dp).clip(RoundedCornerShape(20.dp)).background(Brush.linearGradient(listOf(Red.copy(alpha = .22f), Red.copy(alpha = .08f)))), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(28.dp))
        }
        Spacer(Modifier.height(17.dp))
        Text(title, color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(body, color = Muted, fontSize = 12.sp, lineHeight = 20.sp, textAlign = TextAlign.Center)
        Spacer(Modifier.height(16.dp))
        Text(badge, color = Red, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(CircleShape).background(Red.copy(alpha = .10f)).padding(horizontal = 14.dp, vertical = 8.dp))
    }
}

@Composable
private fun GlassNavigation(modifier: Modifier = Modifier, selected: Section, locale: String, showPlayerStats: Boolean, showCompetitions: Boolean, onSelect: (Section) -> Unit) {
    Box(
        modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.navigationBars).padding(horizontal = 14.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
      Row(
        Modifier.fillMaxWidth().height(66.dp)
            .shadow(16.dp, RoundedCornerShape(28.dp))
            .clip(RoundedCornerShape(28.dp))
            .background(if (nativeThemeIsLight) Color.White.copy(alpha = .84f) else Color(0xFF191B1F).copy(alpha = .88f))
            .border(1.dp, Brush.linearGradient(listOf(Color.White.copy(alpha = .22f), GlassBorder, Red.copy(alpha = .12f))), RoundedCornerShape(28.dp))
            .padding(horizontal = 7.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
      ) {
        (if (locale == "ar") Section.entries.reversed() else Section.entries).filter { (showPlayerStats || it != Section.PLAYER_STATS) && (showCompetitions || it != Section.COMPETITIONS) }.forEach { item ->
            val active = selected == item
            val width by animateDpAsState(if (active) 72.dp else 48.dp, label = "nav-width")
            val interaction = remember { MutableInteractionSource() }
            Column(
                Modifier.width(width).height(54.dp).clip(RoundedCornerShape(18.dp))
                    .clickable(interactionSource = interaction, indication = null) { onSelect(item) }
                    .padding(horizontal = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                AnimatedContent(targetState = active, label = "nav-icon-${item.name}") {
                    // Keep one outline asset for every state. Selection changes only
                    // its tint, while the active item width animates as before.
                    Icon(item.icon, contentDescription = item.title(locale), tint = if (active) Red else Muted, modifier = Modifier.size(22.dp))
                }
                if (active) {
                    Spacer(Modifier.height(2.dp))
                    Text(item.title(locale), color = Red, fontSize = 8.sp, fontWeight = FontWeight.Bold, maxLines = 1, softWrap = false)
                }
            }
        }
      }
    }
}
