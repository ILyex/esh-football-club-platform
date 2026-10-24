package dz.esh.footballclub.publicapp

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import java.io.File
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.runtime.*
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val Canvas = Color(0xFF111315)
private val Panel = Color(0xFF1A1D20)
private val PanelRaised = Color(0xFF202328)
private val Glass = Color(0xFF25292E)
private val Accent = Color(0xFFDC2626)
// Keep interactive accents within the club's red identity; reserve champagne
// for secondary metadata so green/red/gold no longer compete in the same view.
private val Mint = Color(0xFFFF596B)
private val Gold = Color(0xFFE8BE72)
private val PrimaryText = Color(0xFFF5F6F7)
private val SecondaryText = Color(0xFF9AA1A9)
private val Hairline = Color.White.copy(alpha = .09f)
private val Cairo = FontFamily(Font(R.font.cairo_variable))

private object PublicIcons {
    val Home = R.drawable.iconly_home
    val HomeSelected = R.drawable.iconly_home_filled
    val Match = R.drawable.ic_match_ball
    val Calendar = R.drawable.iconly_calendar
    val Media = R.drawable.iconly_camera
    val News = R.drawable.iconly_paper
    val Alerts = R.drawable.iconly_notification
    val AlertsSelected = R.drawable.iconly_notification_filled
    val Language = R.drawable.iconly_language
    val Training = R.drawable.iconly_activity
    val Play = R.drawable.iconly_game
    val Announcement = R.drawable.iconly_notification
    val Shield = R.drawable.iconly_shield_done
    val Delete = R.drawable.iconly_delete
    val Trophy = R.drawable.iconly_star
    val Team = R.drawable.iconly_users
    val Club = R.drawable.iconly_shield_done
}

private enum class PublicTab { HOME, TEAM, MATCHES, COMPETITIONS, NEWS, GALLERY, CLUB, ALERTS }

class MainActivity : ComponentActivity() {
    @Suppress("DEPRECATION")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = android.graphics.Color.TRANSPARENT
        window.navigationBarColor = android.graphics.Color.TRANSPARENT
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        if (Build.VERSION.SDK_INT >= 29) window.isNavigationBarContrastEnforced = false
        setContent { PublicApp() }
    }
}

private fun installPublicApk(context: android.content.Context, apkFile: File): Boolean {
    if (!apkFile.isFile || apkFile.length() <= 0L) return false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
        context.getSharedPreferences("esh_public_app_updater", 0).edit()
            .putString("pending_update_path", apkFile.absolutePath).apply()
        val settings = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return runCatching { context.startActivity(settings); true }.getOrDefault(false)
    }
    return runCatching {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", apkFile)
        val install = Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            .apply { clipData = android.content.ClipData.newRawUri("ESH app update", uri) }
        context.startActivity(install)
        true
    }.getOrDefault(false)
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalMaterialApi::class)
@Composable
private fun PublicApp() {
    val context = LocalContext.current
    val preferences = remember { context.getSharedPreferences(PublicMessagingService.PREFS, 0) }
    var locale by remember { mutableStateOf(preferences.getString(PublicMessagingService.LOCALE, "ar") ?: "ar") }
    var tab by remember {
        mutableStateOf(when ((context as? MainActivity)?.intent?.getStringExtra("open_tab")) {
            "alerts" -> PublicTab.ALERTS
            "matches" -> PublicTab.MATCHES
            else -> PublicTab.HOME
        })
    }
    var snapshot by remember { mutableStateOf<PublicSnapshot?>(null) }
    var snapshotLocale by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var refreshing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf(false) }
    var refreshKey by remember { mutableIntStateOf(0) }
    var selectedMatch by remember { mutableStateOf<PublicMatchCenter?>(null) }
    var selectedArticle by remember { mutableStateOf<PublicArticle?>(null) }
    var selectedAlbum by remember { mutableStateOf<PublicAlbum?>(null) }
    var selectedPhoto by remember { mutableStateOf<PublicPhoto?>(null) }
    var selectedVideo by remember { mutableStateOf<String?>(null) }
    var alertItems by remember { mutableStateOf(PublicMessagingService.alerts(context)) }
    var updateRelease by remember { mutableStateOf<PublicRelease?>(null) }
    var checkingUpdate by remember { mutableStateOf(false) }
    var downloadingUpdate by remember { mutableStateOf(false) }
    var updateProgress by remember { mutableIntStateOf(0) }
    var updateError by remember { mutableStateOf<String?>(null) }
    var publicTeams by remember(locale) { mutableStateOf<List<PublicTeam>>(emptyList()) }
    var teamsLoading by remember(locale) { mutableStateOf(false) }
    var teamsLoadedAtRefresh by remember(locale) { mutableIntStateOf(-1) }
    var publicCompetitions by remember(locale) { mutableStateOf<List<PublicCompetition>>(emptyList()) }
    var competitionsLoading by remember(locale) { mutableStateOf(false) }
    var competitionsLoadedAtRefresh by remember(locale) { mutableIntStateOf(-1) }
    val scope = rememberCoroutineScope()
    val updaterPreferences = remember { context.getSharedPreferences("esh_public_app_updater", 0) }
    val pullRefreshState = androidx.compose.material.pullrefresh.rememberPullRefreshState(refreshing, { refreshKey++ })
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }

    fun checkForAppUpdate() {
        if (checkingUpdate || downloadingUpdate) return
        scope.launch {
            checkingUpdate = true
            val result = withContext(Dispatchers.IO) { runCatching { PublicApi.latestRelease() } }
            checkingUpdate = false
            val release = result.getOrNull()
            @Suppress("DEPRECATION")
            val installedVersion = runCatching { context.packageManager.getPackageInfo(context.packageName, 0).versionName.orEmpty() }.getOrDefault("")
            val dismissed = updaterPreferences.getString("dismissed_update", null)
            if (release != null && PublicApi.isUpdateAvailable(release.version, installedVersion) && dismissed != release.version) {
                updateRelease = release
            }
        }
    }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33) permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        PublicMessagingService.registerIfConfigured(context, locale)
        delay(1_800)
        checkForAppUpdate()
    }
    LaunchedEffect(locale) { PublicMessagingService.registerIfConfigured(context, locale) }
    LaunchedEffect(locale, refreshKey) {
        if (snapshotLocale != locale) {
            snapshot = withContext(Dispatchers.IO) { PublicApi.cachedSnapshot(context, locale) }
            snapshotLocale = locale
        }
        loading = snapshot == null
        refreshing = snapshot != null
        try {
            var attempt = 0
            while (attempt < 2) {
                val result = runCatching { withContext(Dispatchers.IO) { PublicApi.fetch(context, locale) } }
                if (result.isSuccess) {
                    snapshot = result.getOrThrow()
                    snapshotLocale = locale
                    LiveMatchNotifications.sync(context, snapshot!!.matches)
                    error = false
                    break
                }
                error = true
                if (attempt == 0) delay(900L)
                attempt++
            }
        } finally {
            loading = false
            refreshing = false
        }
    }
    LaunchedEffect(tab) {
        if (tab == PublicTab.ALERTS) {
            // FCM can arrive while the inbox is visible, so keep the Compose
            // state in sync with the service's app-local notification store.
            while (true) {
                alertItems = PublicMessagingService.alerts(context)
                delay(1_500L)
            }
        }
    }
    LaunchedEffect(tab, locale, refreshKey) {
        if (tab == PublicTab.TEAM && teamsLoadedAtRefresh != refreshKey) {
            teamsLoading = true
            runCatching { withContext(Dispatchers.IO) { PublicApi.teams(locale) } }
                .onSuccess { publicTeams = it; teamsLoadedAtRefresh = refreshKey }
            teamsLoading = false
        }
        if (tab == PublicTab.COMPETITIONS && competitionsLoadedAtRefresh != refreshKey) {
            competitionsLoading = true
            runCatching { withContext(Dispatchers.IO) { PublicApi.competitions(locale) } }
                .onSuccess { publicCompetitions = it; competitionsLoadedAtRefresh = refreshKey }
            competitionsLoading = false
        }
    }

    DisposableEffect(context) {
        val activity = context as? ComponentActivity
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                val pendingPath = updaterPreferences.getString("pending_update_path", null)
                if (pendingPath != null && (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.packageManager.canRequestPackageInstalls())) {
                    updaterPreferences.edit().remove("pending_update_path").apply()
                    installPublicApk(context, File(pendingPath))
                }
                checkForAppUpdate()
            }
        }
        activity?.lifecycle?.addObserver(observer)
        onDispose { activity?.lifecycle?.removeObserver(observer) }
    }

    MaterialTheme(
        colorScheme = darkColorScheme(background = Canvas, surface = Panel, primary = Accent, secondary = Mint, onSurface = PrimaryText),
        typography = Typography()
    ) {
      CompositionLocalProvider(LocalTextStyle provides MaterialTheme.typography.bodyMedium.copy(fontFamily = Cairo)) {
      CompositionLocalProvider(LocalLayoutDirection provides if (locale == "ar") LayoutDirection.Rtl else LayoutDirection.Ltr) {
        Scaffold(
            containerColor = Canvas,
            contentWindowInsets = WindowInsets(0, 0, 0, 0),
            topBar = {
                PublicTopBar(locale, snapshot?.club, modifier = Modifier.statusBarsPadding(), onToggleLocale = {
                    locale = if (locale == "ar") "fr" else "ar"
                    preferences.edit().putString(PublicMessagingService.LOCALE, locale).apply()
                })
            },
            bottomBar = {
                PublicBottomBar(tab, locale) { tab = it }
            }
        ) { padding ->
          Box(Modifier.fillMaxSize().pullRefresh(pullRefreshState)) {
            Box(Modifier.fillMaxSize().padding(padding)) {
                val data = snapshot
                if (data == null && loading) LoadingScreen(locale)
                else if (data == null) ErrorScreen(locale, error) { refreshKey++ }
                else AnimatedContent(targetState = tab, label = "public-tab") { page ->
                    when (page) {
                        PublicTab.HOME -> HomeScreen(data, locale, onMatch = { id ->
                            scope.launch { selectedMatch = withContext(Dispatchers.IO) { PublicApi.matchCenter(id) } }
                        }, onArticle = { slug -> scope.launch { selectedArticle = withContext(Dispatchers.IO) { PublicApi.article(slug, locale) } } }, onTab = { tab = it })
                        PublicTab.TEAM -> TeamsScreen(publicTeams, teamsLoading, locale)
                        PublicTab.MATCHES -> MatchesScreen(data, locale) { id -> scope.launch { selectedMatch = withContext(Dispatchers.IO) { PublicApi.matchCenter(id) } } }
                        PublicTab.COMPETITIONS -> CompetitionsScreen(publicCompetitions, competitionsLoading, locale)
                        PublicTab.GALLERY -> MediaScreen(data, locale, onAlbum = { id -> scope.launch { selectedAlbum = withContext(Dispatchers.IO) { PublicApi.album(id) } } }, onPhoto = { selectedPhoto = it }, onVideo = { selectedVideo = it })
                        PublicTab.NEWS -> NewsScreen(data, locale) { slug -> scope.launch { selectedArticle = withContext(Dispatchers.IO) { PublicApi.article(slug, locale) } } }
                        PublicTab.CLUB -> ClubScreen(data, locale)
                        PublicTab.ALERTS -> AlertsScreen(alertItems, locale, onDismiss = { item -> PublicMessagingService.dismiss(context, item.id); alertItems = PublicMessagingService.alerts(context) })
                    }
                }
                if (data != null && error) Text(L(locale, "تعذر تحديث بعض البيانات · نعرض آخر محتوى محمّل", "Mise à jour impossible · affichage des derniers contenus reçus"), Modifier.align(Alignment.BottomCenter).padding(8.dp).clip(CircleShape).background(PanelRaised).padding(horizontal = 12.dp, vertical = 7.dp), color = Gold, fontSize = 10.sp)
            }
            PullRefreshIndicator(refreshing, pullRefreshState, Modifier.align(Alignment.TopCenter), backgroundColor = Panel, contentColor = Accent)
          }
        }
      }
      }
    }

    selectedMatch?.let { MatchDialog(it, locale) { selectedMatch = null } }
    selectedArticle?.let { ArticleDialog(it, locale) { selectedArticle = null } }
    selectedAlbum?.let { AlbumDialog(it, locale, onPhoto = { selectedPhoto = it }, onVideo = { selectedVideo = it }, onDismiss = { selectedAlbum = null }) }
    selectedPhoto?.let { photo -> Dialog(onDismissRequest = { selectedPhoto = null }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Color.Black).clickable { selectedPhoto = null }, contentAlignment = Alignment.Center) {
            AsyncImage(model = photo.url, contentDescription = photo.caption.orEmpty(), modifier = Modifier.fillMaxWidth(), contentScale = ContentScale.Fit)
        }
    } }
    selectedVideo?.let { video -> VideoDialog(video) { selectedVideo = null } }

    updateRelease?.let { release ->
        AlertDialog(
            onDismissRequest = { if (!downloadingUpdate) { updaterPreferences.edit().putString("dismissed_update", release.version).apply(); updateRelease = null } },
            containerColor = Panel,
            title = { Text(L(locale, "تحديث جديد متاح", "Mise à jour disponible"), color = PrimaryText, fontWeight = FontWeight.Black) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(L(locale, "الإصدار ${release.version} جاهز. سيُنزّل داخل التطبيق ثم يفتح مثبت أندرويد.", "La version ${release.version} est prête. Elle sera téléchargée dans l’application puis l’installateur Android s’ouvrira."), color = SecondaryText, fontSize = 12.sp, lineHeight = 19.sp)
                    if (downloadingUpdate) LinearProgressIndicator(progress = { updateProgress / 100f }, modifier = Modifier.fillMaxWidth(), color = Accent, trackColor = PanelRaised)
                    if (downloadingUpdate) Text("$updateProgress%", color = Gold, fontSize = 11.sp)
                    updateError?.let { Text(it, color = Color(0xFFFF8895), fontSize = 11.sp) }
                }
            },
            confirmButton = {
                TextButton(enabled = !downloadingUpdate, onClick = {
                    downloadingUpdate = true
                    updateError = null
                    scope.launch {
                        val result = withContext(Dispatchers.IO) {
                            runCatching { PublicApi.downloadApk(context, release) { value -> if (value > updateProgress) scope.launch { updateProgress = value } } }
                        }
                        downloadingUpdate = false
                        result.onSuccess { file ->
                            updateRelease = null
                            if (!installPublicApk(context, file)) updateError = L(locale, "تعذر فتح مثبت التحديث. تحقق من صلاحية تثبيت التطبيقات لهذا التطبيق.", "Impossible d’ouvrir l’installation. Vérifiez l’autorisation d’installation pour cette application.")
                        }.onFailure { updateError = L(locale, "تعذر تنزيل التحديث أو التحقق من سلامته. حاول مرة أخرى.", "Téléchargement ou vérification impossible. Réessayez.") }
                    }
                }) { Text(if (downloadingUpdate) L(locale, "جارٍ التنزيل", "Téléchargement…") else L(locale, "تنزيل وتثبيت", "Télécharger et installer"), color = Accent, fontWeight = FontWeight.Bold) }
            },
            dismissButton = { TextButton(enabled = !downloadingUpdate, onClick = { updaterPreferences.edit().putString("dismissed_update", release.version).apply(); updateRelease = null }) { Text(L(locale, "لاحقًا", "Plus tard"), color = SecondaryText) } }
        )
    }
    updateError?.takeIf { updateRelease == null }?.let { message ->
        AlertDialog(onDismissRequest = { updateError = null }, text = { Text(message, color = PrimaryText) }, confirmButton = { TextButton(onClick = { updateError = null }) { Text(L(locale, "حسنًا", "OK"), color = Accent) } }, containerColor = Panel)
    }
}

@Composable
private fun PublicTopBar(locale: String, club: PublicClub?, modifier: Modifier = Modifier, onToggleLocale: () -> Unit) {
    Row(Modifier.fillMaxWidth().background(Canvas).then(modifier).padding(horizontal = 17.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(45.dp).clip(CircleShape).background(Glass).border(1.dp, Hairline, CircleShape).padding(5.dp), contentAlignment = Alignment.Center) {
            AsyncImage(model = club?.logo ?: R.drawable.esh_logo, contentDescription = "ESH", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(club?.shortName ?: "ESH", color = PrimaryText, fontSize = 16.sp, fontWeight = FontWeight.Black, letterSpacing = 1.3.sp, maxLines = 1)
            Text(club?.name ?: L(locale, "الجمعية الرياضية أمل سيدي حسني", "Association Sportive Espoir Sidi Hosni"), color = SecondaryText, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Surface(onClick = onToggleLocale, shape = RoundedCornerShape(13.dp), color = Panel, border = BorderStroke(1.dp, Hairline)) {
            Row(Modifier.height(38.dp).padding(horizontal = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                AppIcon(PublicIcons.Language, null, Accent, Modifier.size(16.dp))
                Text(if (locale == "ar") "FR" else "ع", color = PrimaryText, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

@Composable
private fun HeaderAction(icon: Int, label: String, onClick: () -> Unit, selected: Boolean = false) {
    Surface(onClick = onClick, modifier = Modifier.size(38.dp), shape = RoundedCornerShape(13.dp), color = if (selected) Accent.copy(alpha = .14f) else Panel, border = BorderStroke(1.dp, if (selected) Accent.copy(alpha = .25f) else Hairline)) {
        Box(contentAlignment = Alignment.Center) { AppIcon(icon, label, if (selected) Mint else PrimaryText, Modifier.size(19.dp)) }
    }
}

@Composable
private fun AppIcon(resource: Int, description: String?, tint: Color, modifier: Modifier = Modifier) {
    Image(painter = painterResource(resource), contentDescription = description, modifier = modifier, colorFilter = ColorFilter.tint(tint))
}

@Composable
private fun PublicBottomBar(selected: PublicTab, locale: String, onSelect: (PublicTab) -> Unit) {
    val tabs = remember { PublicTab.entries.filter { it != PublicTab.ALERTS } }
    val listState = rememberLazyListState()
    val navScope = rememberCoroutineScope()
    LaunchedEffect(selected) {
        tabs.indexOf(selected).takeIf { it >= 0 }?.let { listState.animateScrollToItem(it) }
    }
    Surface(
        modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 13.dp, vertical = 7.dp),
        color = PanelRaised,
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, Hairline),
        shadowElevation = 16.dp
    ) {
        Box {
          LazyRow(state = listState, modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(horizontal = 5.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
            items(tabs) { item ->
                val active = selected == item
                Surface(onClick = { onSelect(item) }, shape = RoundedCornerShape(14.dp), color = if (active) Accent.copy(alpha = .16f) else Color.Transparent) {
                    Row(Modifier.padding(horizontal = 11.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        AppIcon(item.icon(active), item.label(locale), if (active) Mint else SecondaryText, Modifier.size(17.dp))
                        Text(item.label(locale), color = if (active) PrimaryText else SecondaryText, fontSize = 10.sp, fontWeight = if (active) FontWeight.ExtraBold else FontWeight.Medium, maxLines = 1, softWrap = false)
                    }
                }
            }
          }
          if (listState.canScrollForward) {
              Surface(
                  onClick = { navScope.launch { listState.animateScrollToItem((listState.firstVisibleItemIndex + 3).coerceAtMost(tabs.lastIndex)) } },
                  modifier = Modifier.align(Alignment.CenterEnd).padding(end = 3.dp).size(27.dp),
                  shape = CircleShape, color = PanelRaised, border = BorderStroke(1.dp, Hairline)
              ) { Box(contentAlignment = Alignment.Center) { AppIcon(if (locale == "ar") R.drawable.iconly_arrow_left else R.drawable.iconly_arrow_right, L(locale, "أقسام أخرى", "Autres rubriques"), Accent, Modifier.size(14.dp)) } }
          }
        }
    }
}

@Composable
private fun HomeScreen(data: PublicSnapshot, locale: String, onMatch: (String) -> Unit, onArticle: (String) -> Unit, onTab: (PublicTab) -> Unit) {
    val featured = data.matches.firstOrNull { it.status == "LIVE" } ?: data.nextMatch ?: data.matches.firstOrNull()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 22.dp), verticalArrangement = Arrangement.spacedBy(17.dp)) {
        item {
            Box(Modifier.fillMaxWidth().height(190.dp).clip(RoundedCornerShape(28.dp)).background(Brush.linearGradient(listOf(Color(0xFF35131B), Color(0xFF1B1E22), Color(0xFF292D32)))).border(1.dp, Hairline, RoundedCornerShape(28.dp))) {
                if (data.club.hero != null) AsyncImage(model = data.club.hero, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alpha = .32f)
                Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Color(0xF0111315), Color(0xA0111315), Color.Transparent))))
                Box(Modifier.align(Alignment.TopEnd).padding(22.dp).size(132.dp).clip(CircleShape).background(Brush.radialGradient(listOf(Accent.copy(alpha = .22f), Color.Transparent))))
                Column(Modifier.align(Alignment.CenterStart).padding(horizontal = 21.dp, vertical = 17.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        Box(Modifier.size(6.dp).clip(CircleShape).background(Mint))
                        Text(L(locale, "من قلب سيدي حسني", "AU CŒUR DE SIDI HOSNI"), color = Mint, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = .8.sp)
                    }
                    Text(data.club.name, color = PrimaryText, fontSize = 21.sp, lineHeight = 29.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(L(locale, "قريبون من الفريق، في كل لحظة", "Au plus près de l’équipe, à chaque instant"), color = Color(0xFFD2D7DC), fontSize = 11.sp)
                }
                Box(Modifier.align(Alignment.BottomEnd).padding(16.dp).size(53.dp).shadow(12.dp, CircleShape).clip(CircleShape).background(Color.White).padding(6.dp), contentAlignment = Alignment.Center) {
                    AsyncImage(model = data.club.logo ?: R.drawable.esh_logo, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                }
            }
        }
        if (data.announcements.isNotEmpty()) item { AnnouncementStrip(data.announcements.first(), locale) }
        if (featured != null) item {
            SectionHeading(L(locale, if (featured.status == "LIVE") "المواجهة الآن" else "المواجهة القادمة", if (featured.status == "LIVE") "Le match en direct" else "Prochain match"), PublicIcons.Match, locale, action = { onTab(PublicTab.MATCHES) })
            MatchCard(featured, locale, clubLogo = data.club.logo, onClick = { onMatch(featured.id) }, featured = true)
        }
        if (data.trainings.isNotEmpty()) item {
            SectionHeading(L(locale, "التدريبات القادمة", "Prochains entraînements"), PublicIcons.Training, locale, action = { onTab(PublicTab.CLUB) })
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) { items(data.trainings.take(4), key = { it.id }) { TrainingCard(it, locale) } }
        }
        if (data.news.isNotEmpty()) item {
            SectionHeading(L(locale, "آخر الأخبار", "Dernières actualités"), PublicIcons.News, locale, action = { onTab(PublicTab.NEWS) })
            NewsCard(data.news.first(), locale, onClick = { onArticle(data.news.first().slug) })
        }
        if (data.albums.isNotEmpty() || data.reels.isNotEmpty()) item {
            SectionHeading(L(locale, "من ألبوم النادي", "Dans l’album du club"), PublicIcons.Media, locale, action = { onTab(PublicTab.GALLERY) })
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                items(data.albums.take(5), key = { it.id }) { album -> AlbumTile(album, locale, Modifier.width(210.dp)) { onTab(PublicTab.GALLERY) } }
            }
        }
    }
}

@Composable
private fun TeamsScreen(teams: List<PublicTeam>, isLoading: Boolean, locale: String) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeading(L(locale, "الفريق", "Équipe"), L(locale, "فئات النادي ولاعبوها", "Les catégories et les effectifs du club"), PublicIcons.Team) }
        if (isLoading && teams.isEmpty()) item { LoadingInline(locale) }
        if (!isLoading && teams.isEmpty()) item { EmptyState(L(locale, "تعذر تحميل فئات الفريق. اسحب للأسفل للمحاولة مجددًا.", "Chargement impossible. Tirez vers le bas pour réessayer.")) }
        items(teams, key = { it.id }) { team ->
            Surface(color = Panel, shape = RoundedCornerShape(19.dp), border = BorderStroke(1.dp, Hairline)) {
                Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(43.dp).clip(RoundedCornerShape(14.dp)).background(Accent.copy(alpha = .13f)), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Team, null, Accent, Modifier.size(21.dp)) }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(categoryLabel(locale, team.category), color = PrimaryText, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp)
                        team.description?.takeIf { it.isNotBlank() }?.let { Text(it, color = SecondaryText, fontSize = 10.sp, maxLines = 2, overflow = TextOverflow.Ellipsis) }
                        if (team.birthYearFrom != null || team.birthYearTo != null) Text("${team.birthYearFrom ?: "…"} – ${team.birthYearTo ?: "…"}", color = Gold, fontSize = 10.sp)
                    }
                    Text("${team.playerCount} ${L(locale, "لاعب", "joueurs")}", color = Mint, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                }
            }
        }
    }
}

@Composable
private fun CompetitionsScreen(competitions: List<PublicCompetition>, isLoading: Boolean, locale: String) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        item { ScreenHeading(L(locale, "المسابقات", "Compétitions"), L(locale, "الترتيب والنتائج الرسمية", "Classements et résultats officiels"), PublicIcons.Trophy) }
        if (isLoading && competitions.isEmpty()) item { LoadingInline(locale) }
        if (!isLoading && competitions.isEmpty()) item { EmptyState(L(locale, "تعذر تحميل ترتيب المسابقات. اسحب للأسفل للمحاولة مجددًا.", "Chargement impossible. Tirez vers le bas pour réessayer.")) }
        items(competitions, key = { it.id }) { competition ->
            Surface(color = Panel, shape = RoundedCornerShape(19.dp), border = BorderStroke(1.dp, Hairline)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        Box(Modifier.size(36.dp).clip(RoundedCornerShape(12.dp)).background(Accent.copy(alpha = .13f)), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Trophy, null, Accent, Modifier.size(18.dp)) }
                        Column(Modifier.weight(1f)) {
                            Text(competition.name, color = PrimaryText, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text("${categoryLabel(locale, competition.category)} · ${competition.season}", color = SecondaryText, fontSize = 9.sp)
                        }
                    }
                    if (competition.standings.isEmpty()) EmptyState(L(locale, "لم يُنشر ترتيب لهذه المسابقة بعد", "Le classement de cette compétition n’est pas encore publié"))
                    else {
                        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(9.dp)).background(PanelRaised).padding(horizontal = 8.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("#", color = SecondaryText, fontSize = 9.sp, modifier = Modifier.width(22.dp))
                            Text(L(locale, "الفريق", "Club"), color = SecondaryText, fontSize = 9.sp, modifier = Modifier.weight(1f))
                            Text(L(locale, "لعب", "J"), color = SecondaryText, fontSize = 9.sp, modifier = Modifier.width(27.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                            Text(L(locale, "+/−", "+/−"), color = SecondaryText, fontSize = 9.sp, modifier = Modifier.width(34.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                            Text(L(locale, "ن", "Pts"), color = Gold, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(30.dp), textAlign = androidx.compose.ui.text.style.TextAlign.End)
                        }
                        competition.standings.take(12).forEach { standing ->
                            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(if (standing.isOurClub) Accent.copy(alpha = .11f) else Color.Transparent).padding(horizontal = 8.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text(standing.rank.toString(), color = if (standing.isOurClub) Accent else SecondaryText, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(22.dp))
                                Text(standing.teamName, color = if (standing.isOurClub) PrimaryText else SecondaryText, fontSize = 10.sp, fontWeight = if (standing.isOurClub) FontWeight.Bold else FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                                Text(standing.played.toString(), color = PrimaryText, fontSize = 10.sp, modifier = Modifier.width(27.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                                Text(if (standing.goalDifference > 0) "+${standing.goalDifference}" else standing.goalDifference.toString(), color = SecondaryText, fontSize = 10.sp, modifier = Modifier.width(34.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                                Text(standing.points.toString(), color = Gold, fontSize = 10.sp, fontWeight = FontWeight.Black, modifier = Modifier.width(30.dp), textAlign = androidx.compose.ui.text.style.TextAlign.End)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ClubScreen(data: PublicSnapshot, locale: String) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        item { ScreenHeading(L(locale, "النادي", "Club"), L(locale, "تعرف على جمعية أمل سيدي حسني", "Découvrez l’Association Sportive Espoir Sidi Hosni"), PublicIcons.Club) }
        item {
            Surface(color = Panel, shape = RoundedCornerShape(21.dp), border = BorderStroke(1.dp, Hairline)) {
                Column(Modifier.fillMaxWidth().padding(17.dp), verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(94.dp).clip(CircleShape).background(Glass).border(1.dp, Hairline, CircleShape).padding(9.dp), contentAlignment = Alignment.Center) { AsyncImage(model = data.club.logo ?: R.drawable.esh_logo, contentDescription = data.club.name, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit) }
                    Text(data.club.name, color = PrimaryText, fontSize = 17.sp, fontWeight = FontWeight.Black, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    data.club.description?.takeIf { it.isNotBlank() }?.let { Text(it, color = SecondaryText, fontSize = 11.sp, lineHeight = 18.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center) }
                }
            }
        }
        data.club.stadium?.takeIf { it.isNotBlank() }?.let { stadium -> item {
            Surface(color = Panel, shape = RoundedCornerShape(17.dp), border = BorderStroke(1.dp, Hairline)) {
                Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    AppIcon(PublicIcons.Calendar, null, Accent, Modifier.size(19.dp))
                    Column { Text(L(locale, "الملعب", "Stade"), color = SecondaryText, fontSize = 9.sp); Text(stadium, color = PrimaryText, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                }
            }
        } }
        if (data.trainings.isNotEmpty()) item { SectionHeading(L(locale, "التدريبات القادمة", "Prochains entraînements"), PublicIcons.Training, locale) }
        items(data.trainings, key = { "club-training-${it.id}" }) { TrainingCard(it, locale) }
    }
}

@Composable
private fun MatchesScreen(data: PublicSnapshot, locale: String, onMatch: (String) -> Unit) {
    var category by remember { mutableStateOf("ALL") }
    val filtered = data.matches.filter { category == "ALL" || it.category == category }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeading(L(locale, "المباريات", "Matchs"), L(locale, "المواعيد والنتائج والأحداث المباشرة", "Calendrier, résultats et événements en direct"), PublicIcons.Match) }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(listOf("ALL", "SENIOR", "U20", "U17", "U15")) { value ->
                    FilterChip(selected = category == value, onClick = { category = value }, label = { Text(categoryLabel(locale, value), fontSize = 11.sp, fontWeight = FontWeight.Bold) }, shape = CircleShape, border = FilterChipDefaults.filterChipBorder(enabled = true, selected = category == value, borderColor = Hairline, selectedBorderColor = Accent.copy(alpha = .5f)), colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Accent.copy(alpha = .18f), selectedLabelColor = Color(0xFFFF8A98), containerColor = Panel, labelColor = SecondaryText))
                }
            }
        }
        val live = filtered.filter { it.status == "LIVE" }
        if (live.isNotEmpty()) item { SectionHeading(L(locale, "مباشر الآن", "En direct"), PublicIcons.Match, locale) }
        items(live, key = { "live-${it.id}" }) { MatchCard(it, locale, clubLogo = data.club.logo, onClick = { onMatch(it.id) }, featured = true) }
        item { SectionHeading(L(locale, "المواعيد القادمة", "Calendrier à venir"), PublicIcons.Calendar, locale) }
        items(filtered.filter { it.status == "SCHEDULED" }, key = { it.id }) { MatchCard(it, locale, clubLogo = data.club.logo, onClick = { onMatch(it.id) }) }
        item { SectionHeading(L(locale, "آخر النتائج", "Derniers résultats"), PublicIcons.Trophy, locale) }
        items(data.results.filter { category == "ALL" || it.category == category }, key = { "result-${it.id}" }) { MatchCard(it, locale, clubLogo = data.club.logo, onClick = { onMatch(it.id) }) }
        if (filtered.isEmpty() && data.results.isEmpty()) item { EmptyState(L(locale, "لا توجد مباريات منشورة حالياً", "Aucun match publié pour le moment")) }
    }
}

@Composable
private fun MediaScreen(data: PublicSnapshot, locale: String, onAlbum: (String) -> Unit, onPhoto: (PublicPhoto) -> Unit, onVideo: (String) -> Unit) {
    val context = LocalContext.current
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { ScreenHeading(L(locale, "المعرض", "Galerie"), L(locale, "صور وفيديوهات الأمل داخل الملعب وخارجه", "Photos et vidéos d’Espoir, sur et en dehors du terrain"), PublicIcons.Media) }
        if (data.reels.isNotEmpty()) item {
            SectionHeading(L(locale, "لقطات النادي", "Les vidéos du club"), PublicIcons.Play, locale)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                items(data.reels, key = { it.id }) { reel ->
                    Surface(Modifier.width(230.dp).height(128.dp).clickable { openUrl(reel.url, context) }, color = Panel, shape = RoundedCornerShape(20.dp), border = BorderStroke(1.dp, Hairline)) {
                        Box(contentAlignment = Alignment.Center) {
                            Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0xFF3B1422), Color(0xFF23262D)))))
                            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(7.dp)) {
                                Box(Modifier.size(46.dp).clip(CircleShape).background(Accent), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Play, null, Color.White, Modifier.size(20.dp)) }
                                Text(reel.title, color = PrimaryText, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            Text(reel.platform.uppercase(), Modifier.align(Alignment.TopStart).padding(11.dp).clip(CircleShape).background(Color.Black.copy(alpha = .38f)).padding(horizontal = 9.dp, vertical = 4.dp), color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
        if (data.albums.isEmpty() && data.reels.isEmpty()) item { EmptyState(L(locale, "لا توجد وسائط منشورة حالياً", "Aucun média publié pour le moment")) }
        items(data.albums, key = { it.id }) { album -> AlbumTile(album, locale, Modifier.fillMaxWidth()) { onAlbum(album.id) } }
        if (data.albums.isNotEmpty()) item {
            SectionHeading(L(locale, "صور مختارة", "Sélection photos"), PublicIcons.Media, locale)
            data.albums.firstOrNull()?.photos?.let { photos ->
                LazyRow(horizontalArrangement = Arrangement.spacedBy(9.dp)) { items(photos, key = { it.id }) { photo -> MediaTile(photo, Modifier.size(width = 150.dp, height = 120.dp), onPhoto, onVideo) } }
            }
        }
    }
}

@Composable
private fun NewsScreen(data: PublicSnapshot, locale: String, onArticle: (String) -> Unit) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeading(L(locale, "الأخبار", "Actualités"), L(locale, "آخر المستجدات من الأسرة الرياضية", "Les dernières nouvelles de la famille sportive"), PublicIcons.News) }
        items(data.announcements, key = { it.id }) { AnnouncementStrip(it, locale) }
        items(data.news, key = { it.id }) { article -> NewsCard(article, locale, onClick = { onArticle(article.slug) }) }
        if (data.news.isEmpty() && data.announcements.isEmpty()) item { EmptyState(L(locale, "لا توجد أخبار منشورة حالياً", "Aucune actualité publiée pour le moment")) }
    }
}

@Composable
private fun AlertsScreen(alerts: List<PublicAlert>, locale: String, onDismiss: (PublicAlert) -> Unit) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
        item { ScreenHeading(L(locale, "التنبيهات", "Notifications"), L(locale, "أهداف وتحديثات المباريات المباشرة", "Buts et actualités des matchs en direct"), PublicIcons.Alerts) }
        item { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.clip(CircleShape).background(Panel).padding(horizontal = 12.dp, vertical = 8.dp)) { Box(Modifier.size(7.dp).clip(CircleShape).background(Accent)); Text(L(locale, "إشعارات تطبيق الجمهور فقط", "Notifications de l’application supporters uniquement"), color = SecondaryText, fontSize = 10.sp) } }
        items(alerts, key = { it.id }) { alert ->
            Surface(color = Panel, shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, Hairline)) {
                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                    Box(Modifier.size(40.dp).clip(CircleShape).background(Accent.copy(alpha = .16f)), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Match, null, Accent, Modifier.size(20.dp)) }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(alert.title, color = PrimaryText, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text(alert.body, color = SecondaryText, fontSize = 11.sp)
                        Text(formatDate(alert.time.toString()), color = Gold, fontSize = 9.sp)
                    }
                    HeaderAction(PublicIcons.Delete, L(locale, "حذف التنبيه", "Supprimer l’alerte"), { onDismiss(alert) })
                }
            }
        }
        if (alerts.isEmpty()) item { EmptyState(L(locale, "ستظهر هنا تنبيهات الأهداف وتحديثات المباريات المباشرة", "Les alertes de buts et de matchs en direct apparaîtront ici")) }
    }
}

@Composable
private fun MatchCard(match: PublicMatch, locale: String, clubLogo: String? = null, onClick: () -> Unit, featured: Boolean = false) {
    val live = match.status == "LIVE"
    Surface(Modifier.fillMaxWidth().shadow(if (featured) 10.dp else 3.dp, RoundedCornerShape(23.dp)).clickable(onClick = onClick).animateContentSize(), color = if (live) Color(0xFF211B20) else if (featured) PanelRaised else Panel, shape = RoundedCornerShape(if (featured) 23.dp else 19.dp), border = BorderStroke(1.dp, if (live) Accent.copy(alpha = .5f) else Hairline)) {
        Column(Modifier.padding(if (featured) 17.dp else 14.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.clip(CircleShape).background(Glass).padding(horizontal = 9.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    AppIcon(PublicIcons.Shield, null, Gold, Modifier.size(13.dp))
                    Text(categoryLabel(locale, match.category ?: ""), color = Gold, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold)
                }
                Spacer(Modifier.weight(1f))
                if (live) LiveBadge(locale) else Text(statusLabel(locale, match.status), color = SecondaryText, fontSize = 9.sp)
            }
            Row(Modifier.fillMaxWidth().padding(vertical = if (featured) 3.dp else 0.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TeamBadge(match.home, if (match.isHomeFixture) clubLogo else match.opponentLogo, modifier = Modifier.weight(1f), featured = featured)
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    if (match.homeScore != null && match.awayScore != null) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                            Text(match.homeScore.toString(), color = PrimaryText, fontSize = if (featured) 30.sp else 24.sp, fontWeight = FontWeight.Black)
                            Text("–", color = if (live) Color(0xFFFF7182) else SecondaryText, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                            Text(match.awayScore.toString(), color = PrimaryText, fontSize = if (featured) 30.sp else 24.sp, fontWeight = FontWeight.Black)
                        }
                    } else Text("VS", color = Mint, fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
                    Text(if (live) L(locale, "مباراة مباشرة", "EN DIRECT") else formatClock(match.date), color = if (live) Color(0xFFFF7182) else SecondaryText, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold)
                }
                TeamBadge(match.away, if (match.isHomeFixture) match.opponentLogo else clubLogo, modifier = Modifier.weight(1f), featured = featured)
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Hairline))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                AppIcon(PublicIcons.Trophy, null, if (live) Gold else SecondaryText, Modifier.size(14.dp))
                Text(match.competition, color = SecondaryText, fontSize = 9.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                if (!live) {
                    AppIcon(PublicIcons.Calendar, null, SecondaryText, Modifier.size(13.dp))
                    Text(formatDate(match.date), color = SecondaryText, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun TeamBadge(name: String, logo: String?, modifier: Modifier = Modifier, featured: Boolean = false) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Box(Modifier.size(if (featured) 48.dp else 42.dp).clip(CircleShape).background(Glass).border(1.dp, Hairline, CircleShape).padding(5.dp), contentAlignment = Alignment.Center) {
            if (!logo.isNullOrBlank()) AsyncImage(model = logo, contentDescription = name, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
            else Text(name.take(1).uppercase(), color = Accent, fontSize = 17.sp, fontWeight = FontWeight.Black)
        }
        Text(name, color = PrimaryText, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

@Composable
private fun LiveBadge(locale: String) {
    Row(Modifier.clip(CircleShape).background(Accent.copy(alpha = .17f)).border(1.dp, Accent.copy(alpha = .28f), CircleShape).padding(horizontal = 9.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Box(Modifier.size(6.dp).clip(CircleShape).background(Color(0xFFFF687A))); Text(L(locale, "مباشر", "EN DIRECT"), color = Color(0xFFFF8795), fontSize = 9.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun TrainingCard(training: PublicTraining, locale: String) {
    Surface(Modifier.width(245.dp), color = Panel, shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, Hairline)) {
        Row(Modifier.padding(13.dp), horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(RoundedCornerShape(13.dp)).background(Mint.copy(alpha = .12f)), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Training, null, Mint, Modifier.size(20.dp)) }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(categoryLabel(locale, training.category), color = PrimaryText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text("${formatDate(training.date)} · ${formatClock(training.start)}", color = Gold, fontSize = 10.sp)
                Text(training.location ?: training.team, color = SecondaryText, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun NewsCard(article: PublicNews, locale: String, onClick: () -> Unit) {
    Surface(Modifier.fillMaxWidth().clickable(onClick = onClick), color = Panel, shape = RoundedCornerShape(19.dp), border = BorderStroke(1.dp, Hairline)) {
        Row(Modifier.heightIn(min = 112.dp), verticalAlignment = Alignment.CenterVertically) {
            if (article.image != null) AsyncImage(model = article.image, contentDescription = null, modifier = Modifier.width(112.dp).height(112.dp), contentScale = ContentScale.Crop)
            Column(Modifier.weight(1f).padding(horizontal = 13.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    article.category?.let { Text(it, color = Gold, fontSize = 9.sp, fontWeight = FontWeight.Bold) }
                    Text(formatDate(article.date), color = SecondaryText, fontSize = 9.sp)
                }
                Text(article.title, color = PrimaryText, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(article.excerpt, color = SecondaryText, fontSize = 10.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            AppIcon(if (locale == "ar") R.drawable.iconly_arrow_left else R.drawable.iconly_arrow_right, null, SecondaryText, Modifier.padding(end = 12.dp).size(17.dp))
        }
    }
}

@Composable
private fun AlbumTile(album: PublicAlbum, locale: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(modifier.clickable(onClick = onClick), color = Panel, shape = RoundedCornerShape(19.dp), border = BorderStroke(1.dp, Hairline)) {
        Column {
            Box(Modifier.fillMaxWidth().height(142.dp).background(PanelRaised)) {
                val cover = album.cover ?: album.photos.firstOrNull()?.url
                if (cover != null && !isVideo(cover)) AsyncImage(model = cover, contentDescription = album.name, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                else Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0xFF3B1422), PanelRaised))), contentAlignment = Alignment.Center) { AppIcon(if (cover != null) PublicIcons.Play else PublicIcons.Media, null, Color.White, Modifier.size(31.dp)) }
                Text("${album.count} ${L(locale, "وسائط", "médias")}", Modifier.align(Alignment.BottomEnd).padding(9.dp).clip(CircleShape).background(Color.Black.copy(alpha = .58f)).padding(horizontal = 9.dp, vertical = 5.dp), color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(album.name, color = PrimaryText, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(album.description ?: albumCategory(locale, album.category), color = SecondaryText, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun MediaTile(photo: PublicPhoto, modifier: Modifier, onPhoto: (PublicPhoto) -> Unit, onVideo: (String) -> Unit) {
    val video = isVideo(photo.url)
    Box(modifier.clip(RoundedCornerShape(16.dp)).background(PanelRaised).clickable { if (video) onVideo(photo.url) else onPhoto(photo) }) {
        if (!video) AsyncImage(model = photo.url, contentDescription = photo.caption.orEmpty(), modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        else Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0xFF3B1422), PanelRaised))), contentAlignment = Alignment.Center) { Box(Modifier.size(52.dp).clip(CircleShape).background(Accent), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Play, null, Color.White, Modifier.size(22.dp)) } }
    }
}

@Composable
private fun AnnouncementStrip(item: PublicAnnouncement, locale: String) {
    val urgent = item.priority.equals("URGENT", true) || item.priority.equals("HIGH", true)
    Surface(color = if (urgent) Color(0xFF32151D) else Panel, shape = RoundedCornerShape(17.dp), border = BorderStroke(1.dp, if (urgent) Accent.copy(alpha = .32f) else Hairline)) {
        Row(Modifier.fillMaxWidth().padding(13.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
            AppIcon(PublicIcons.Announcement, null, if (urgent) Accent else Gold, Modifier.size(19.dp))
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) { Text(item.title, color = PrimaryText, fontSize = 12.sp, fontWeight = FontWeight.Bold); Text(item.content, color = SecondaryText, fontSize = 10.sp, lineHeight = 16.sp, maxLines = 3, overflow = TextOverflow.Ellipsis) }
        }
    }
}

@Composable
private fun SectionHeading(title: String, icon: Int, locale: String, action: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(bottom = 9.dp), verticalAlignment = Alignment.CenterVertically) {
        AppIcon(icon, null, Accent, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp))
        Text(title, color = PrimaryText, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f))
        if (action != null) Text(L(locale, "عرض الكل", "Tout voir"), Modifier.clickable(onClick = action), color = Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun ScreenHeading(title: String, subtitle: String, icon: Int) {
    Row(Modifier.fillMaxWidth().padding(bottom = 5.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.size(48.dp).clip(RoundedCornerShape(16.dp)).background(Accent.copy(alpha = .14f)).border(1.dp, Accent.copy(alpha = .2f), RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) { AppIcon(icon, null, Accent, Modifier.size(23.dp)) }
        Column { Text(title, color = PrimaryText, fontSize = 20.sp, fontWeight = FontWeight.Black); Text(subtitle, color = SecondaryText, fontSize = 10.sp) }
    }
}

@Composable
private fun MatchDialog(center: PublicMatchCenter, locale: String, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(color = Panel, shape = RoundedCornerShape(24.dp), border = BorderStroke(1.dp, Hairline), modifier = Modifier.fillMaxWidth().heightIn(max = 660.dp)) {
            LazyColumn(Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item { Row(verticalAlignment = Alignment.CenterVertically) { Text(L(locale, "مركز المباراة", "Centre du match"), color = PrimaryText, fontWeight = FontWeight.Black, fontSize = 18.sp, modifier = Modifier.weight(1f)); TextButton(onClick = onDismiss) { Text(L(locale, "إغلاق", "Fermer"), color = Gold) } } }
                item { MatchCard(center.match, locale, onClick = {}, featured = true) }
                item { SectionHeading(L(locale, "أحداث المباراة", "Événements du match"), PublicIcons.Match, locale) }
                if (center.events.isEmpty()) item { EmptyState(L(locale, "لا توجد أحداث مسجلة بعد", "Aucun événement enregistré")) }
                items(center.events, key = { it.id }) { event -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("${event.minute}′", color = Gold, fontWeight = FontWeight.Black, fontSize = 12.sp); Box(Modifier.size(7.dp).clip(CircleShape).background(if (event.type.contains("GOAL")) Accent else SecondaryText)); Text(event.player.ifBlank { event.type }, color = PrimaryText, fontSize = 12.sp)
                } }
                if (center.starting.isNotEmpty()) item { Text(L(locale, "التشكيلة الأساسية", "Onze de départ"), color = Gold, fontWeight = FontWeight.Bold, fontSize = 12.sp) }
                items(center.starting) { Text("•  $it", color = SecondaryText, fontSize = 11.sp) }
                if (center.substitutes.isNotEmpty()) item { Text(L(locale, "الاحتياط", "Remplaçants"), color = Gold, fontWeight = FontWeight.Bold, fontSize = 12.sp) }
                items(center.substitutes) { Text("•  $it", color = SecondaryText, fontSize = 11.sp) }
            }
        }
    }
}

@Composable
private fun ArticleDialog(article: PublicArticle, locale: String, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(color = Panel, shape = RoundedCornerShape(24.dp), border = BorderStroke(1.dp, Hairline), modifier = Modifier.fillMaxWidth().heightIn(max = 650.dp)) {
            Column {
                if (article.image != null) AsyncImage(model = article.image, contentDescription = null, modifier = Modifier.fillMaxWidth().height(190.dp), contentScale = ContentScale.Crop)
                Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(article.category ?: L(locale, "أخبار النادي", "Actualités du club"), color = Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text(article.title, color = PrimaryText, fontSize = 19.sp, fontWeight = FontWeight.Black)
                    Text(article.content, color = Color(0xFFD4D7DD), fontSize = 13.sp, lineHeight = 22.sp)
                    TextButton(onClick = onDismiss) { Text(L(locale, "إغلاق", "Fermer"), color = Accent) }
                }
            }
        }
    }
}

@Composable
private fun AlbumDialog(album: PublicAlbum, locale: String, onPhoto: (PublicPhoto) -> Unit, onVideo: (String) -> Unit, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxWidth().fillMaxHeight(.88f).padding(12.dp), color = Panel, shape = RoundedCornerShape(24.dp), border = BorderStroke(1.dp, Hairline)) {
            Column(Modifier.padding(15.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text(album.name, color = PrimaryText, fontSize = 17.sp, fontWeight = FontWeight.Black); album.description?.let { Text(it, color = SecondaryText, fontSize = 10.sp) } }; TextButton(onClick = onDismiss) { Text(L(locale, "إغلاق", "Fermer"), color = Gold) } }
                Spacer(Modifier.height(10.dp))
                LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(album.photos, key = { it.id }) { photo ->
                        Column {
                            MediaTile(photo, Modifier.fillMaxWidth().height(210.dp), onPhoto, onVideo)
                            photo.caption?.takeIf { it.isNotBlank() }?.let { Text(it, Modifier.padding(top = 5.dp), color = SecondaryText, fontSize = 10.sp) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun VideoDialog(url: String, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val player = remember(url) { ExoPlayer.Builder(context).build().apply { setMediaItem(MediaItem.fromUri(url)); prepare(); playWhenReady = true } }
    DisposableEffect(player) { onDispose { player.release() } }
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxWidth().background(Color.Black, RoundedCornerShape(20.dp)).padding(10.dp)) {
            AndroidView(factory = { ctx -> PlayerView(ctx).apply { this.player = player; useController = true } }, modifier = Modifier.fillMaxWidth().height(245.dp))
            TextButton(onClick = onDismiss, modifier = Modifier.align(Alignment.End)) { Text("إغلاق", color = Color.White) }
        }
    }
}

@Composable
private fun LoadingScreen(locale: String) { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) { CircularProgressIndicator(color = Accent); Text(L(locale, "نجهز لك جديد النادي...", "Chargement des nouvelles du club…"), color = SecondaryText, fontSize = 12.sp) } } }

@Composable
private fun LoadingInline(locale: String) { Row(Modifier.fillMaxWidth().padding(vertical = 22.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) { CircularProgressIndicator(Modifier.size(18.dp), color = Accent, strokeWidth = 2.dp); Spacer(Modifier.width(9.dp)); Text(L(locale, "جارٍ التحميل", "Chargement…"), color = SecondaryText, fontSize = 11.sp) } }

@Composable
private fun ErrorScreen(locale: String, error: Boolean, onRetry: () -> Unit) {
    Box(Modifier.fillMaxSize().padding(28.dp), contentAlignment = Alignment.Center) {
        Surface(color = Panel, shape = RoundedCornerShape(22.dp), border = BorderStroke(1.dp, Hairline)) {
            Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.size(54.dp).clip(CircleShape).background(Accent.copy(alpha = .13f)), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.News, null, Accent, Modifier.size(26.dp)) }
                Text(L(locale, "نحاول الاتصال بالنادي", "Connexion au club en cours"), color = PrimaryText, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Text(L(locale, "تحقق من اتصال الإنترنت، ثم أعد المحاولة. سيظهر المحتوى المحفوظ هنا عند توفره.", "Vérifiez votre connexion puis réessayez. Le dernier contenu enregistré s’affichera ici dès qu’il sera disponible."), color = SecondaryText, fontSize = 11.sp, lineHeight = 17.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                Button(onClick = onRetry, colors = ButtonDefaults.buttonColors(containerColor = Accent), shape = RoundedCornerShape(13.dp)) { Text(L(locale, "إعادة المحاولة", "Réessayer"), color = Color.White, fontWeight = FontWeight.Bold) }
            }
        }
    }
}

@Composable
private fun EmptyState(text: String) { Surface(Modifier.fillMaxWidth(), color = Panel, shape = RoundedCornerShape(17.dp), border = BorderStroke(1.dp, Hairline)) { Text(text, Modifier.padding(20.dp).fillMaxWidth(), color = SecondaryText, fontSize = 11.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center) } }

private fun PublicTab.icon(selected: Boolean) = when (this) {
    PublicTab.HOME -> if (selected) PublicIcons.HomeSelected else PublicIcons.Home
    PublicTab.TEAM -> PublicIcons.Team
    PublicTab.MATCHES -> PublicIcons.Match
    PublicTab.COMPETITIONS -> PublicIcons.Trophy
    PublicTab.NEWS -> PublicIcons.News
    PublicTab.GALLERY -> PublicIcons.Media
    PublicTab.CLUB -> PublicIcons.Club
    PublicTab.ALERTS -> if (selected) PublicIcons.AlertsSelected else PublicIcons.Alerts
}
private fun PublicTab.label(locale: String) = when (this) {
    PublicTab.HOME -> L(locale, "الرئيسية", "Accueil")
    PublicTab.TEAM -> L(locale, "الفريق", "Équipe")
    PublicTab.MATCHES -> L(locale, "المباريات", "Matchs")
    PublicTab.COMPETITIONS -> L(locale, "المسابقات", "Compétitions")
    PublicTab.NEWS -> L(locale, "الأخبار", "Actualités")
    PublicTab.GALLERY -> L(locale, "المعرض", "Galerie")
    PublicTab.CLUB -> L(locale, "النادي", "Club")
    PublicTab.ALERTS -> L(locale, "التنبيهات", "Notifications")
}
private fun L(locale: String, arabic: String, french: String) = if (locale == "ar") arabic else french
private fun categoryLabel(locale: String, category: String) = when (category) { "SENIOR" -> L(locale, "الأكابر", "Seniors"); "U20" -> "U20"; "U17" -> "U17"; "U15" -> "U15"; "ALL" -> L(locale, "الكل", "Tous"); else -> category }
private fun albumCategory(locale: String, category: String) = when (category) { "MATCHES" -> L(locale, "مباريات", "Matchs"); "TRAINING" -> L(locale, "تدريبات", "Entraînements"); "TEAM" -> L(locale, "الفريق", "Équipe"); "EVENTS" -> L(locale, "فعاليات", "Événements"); else -> L(locale, "النادي", "Club") }
private fun statusLabel(locale: String, status: String) = when (status) { "SCHEDULED" -> L(locale, "قادمة", "À venir"); "FINISHED" -> L(locale, "انتهت", "Terminé"); "POSTPONED" -> L(locale, "مؤجلة", "Reporté"); "CANCELLED" -> L(locale, "ملغاة", "Annulé"); else -> status }
private fun formatDate(value: String): String = value.take(16).replace('T', ' ').replace('-', '/')
private fun formatClock(value: String): String = value.substringAfter('T', value).take(5)
private fun isVideo(url: String) = listOf(".mp4", ".webm", ".mov", ".m3u8").any { url.substringBefore('?').lowercase().endsWith(it) }
private fun openUrl(url: String, context: android.content.Context) { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } }
