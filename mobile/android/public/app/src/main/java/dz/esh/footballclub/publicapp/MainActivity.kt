package dz.esh.footballclub.publicapp

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.geometry.Offset
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
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val Canvas = Color(0xFF0C0D0E)
private val Panel = Color(0xFF161819)
private val PanelRaised = Color(0xFF1C1E20)
private val Glass = Color(0xFF1C1E20)
private val Accent = Color(0xFFDC2626)
// Use only the website palette: ESH red, its dark surfaces, and neutral text.
private val Mint = Accent
private val Gold = Accent
private val PrimaryText = Color(0xFFF2F4F5)
private val SecondaryText = Color(0xFF7A8189)
private val Hairline = Color(0xFF21272B).copy(alpha = .84f)
private val Cairo = FontFamily(Font(R.font.cairo_variable))

private fun Modifier.siteGlass(shape: RoundedCornerShape, accentGlow: Boolean = false): Modifier =
    this
        .clip(shape)
        .background(
            Brush.linearGradient(
                listOf(
                    PanelRaised.copy(alpha = .96f),
                    Panel.copy(alpha = .98f),
                    if (accentGlow) Accent.copy(alpha = .075f) else Color.White.copy(alpha = .025f)
                )
            ),
            shape
        )

private object PublicIcons {
    val Home = R.drawable.iconly_home
    val HomeSelected = R.drawable.iconly_home_filled
    val Match = R.drawable.iconly_calendar
    val MatchSelected = R.drawable.iconly_calendar_filled
    val Calendar = R.drawable.iconly_calendar
    val Media = R.drawable.iconly_camera
    val News = R.drawable.iconly_paper
    val Alerts = R.drawable.iconly_notification
    val AlertsSelected = R.drawable.iconly_notification_filled
    val Language = R.drawable.iconly_language
    val Training = R.drawable.iconly_activity
    // Reuse the administration app's Iconly set so both apps stay visually aligned.
    val Play = R.drawable.iconly_game
    val Close = R.drawable.iconly_close_square
    val Announcement = R.drawable.iconly_notification
    val Shield = R.drawable.iconly_shield_done
    val Delete = R.drawable.iconly_delete
    val Trophy = R.drawable.iconly_star
    val Team = R.drawable.iconly_users
    val Club = R.drawable.iconly_shield_done
    val More = R.drawable.iconly_more_circle
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
    var selectedMatchId by remember { mutableStateOf<String?>(null) }
    var matchCenter by remember { mutableStateOf<PublicMatchCenter?>(null) }
    var matchDetailLoading by remember { mutableStateOf(false) }
    var matchDetailError by remember { mutableStateOf(false) }
    var matchDetailRetry by remember { mutableIntStateOf(0) }
    var selectedArticleSlug by remember { mutableStateOf<String?>(null) }
    var selectedArticle by remember { mutableStateOf<PublicArticle?>(null) }
    var articleLoading by remember { mutableStateOf(false) }
    var articleLoadError by remember { mutableStateOf(false) }
    var articleRetry by remember { mutableIntStateOf(0) }
    var selectedAlbum by remember { mutableStateOf<PublicAlbum?>(null) }
    var selectedPhoto by remember { mutableStateOf<PublicPhoto?>(null) }
    var selectedVideo by remember { mutableStateOf<String?>(null) }
    var selectedReel by remember { mutableStateOf<PublicReel?>(null) }
    var showMoreSections by remember { mutableStateOf(false) }
    var alertItems by remember { mutableStateOf(PublicMessagingService.alerts(context)) }
    var publicTeams by remember(locale) { mutableStateOf<List<PublicTeam>>(emptyList()) }
    var teamsLoading by remember(locale) { mutableStateOf(false) }
    var teamsLoadedAtRefresh by remember(locale) { mutableIntStateOf(-1) }
    var publicCompetitions by remember(locale) { mutableStateOf<List<PublicCompetition>>(emptyList()) }
    var competitionsLoading by remember(locale) { mutableStateOf(false) }
    var competitionsError by remember(locale) { mutableStateOf(false) }
    var competitionsLoadedAtRefresh by remember(locale) { mutableIntStateOf(-1) }
    val scope = rememberCoroutineScope()
    val pullRefreshState = androidx.compose.material.pullrefresh.rememberPullRefreshState(refreshing, { refreshKey++ })

    BackHandler(enabled = selectedMatchId != null || selectedArticleSlug != null) {
        if (selectedArticleSlug != null) {
            selectedArticleSlug = null
            selectedArticle = null
        } else selectedMatchId = null
    }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33) {
            val activity = context as? Activity
            if (activity != null && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
            }
        }
        PublicMessagingService.registerIfConfigured(context, locale)
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
    LaunchedEffect(selectedMatchId, locale, matchDetailRetry) {
        val id = selectedMatchId ?: run {
            matchCenter = null
            matchDetailLoading = false
            matchDetailError = false
            return@LaunchedEffect
        }
        matchCenter = null
        matchDetailError = false
        matchDetailLoading = true
        try {
            val result = runCatching { withContext(Dispatchers.IO) { PublicApi.matchCenter(id, locale) } }
            if (selectedMatchId == id) {
                matchCenter = result.getOrNull()
                matchDetailError = result.isFailure
            }
        } finally {
            matchDetailLoading = false
        }
    }
    LaunchedEffect(selectedArticleSlug, locale, articleRetry) {
        val slug = selectedArticleSlug ?: run {
            selectedArticle = null
            articleLoading = false
            articleLoadError = false
            return@LaunchedEffect
        }
        selectedArticle = null
        articleLoadError = false
        articleLoading = true
        try {
            val result = runCatching { withContext(Dispatchers.IO) { PublicApi.article(slug, locale) } }
            if (selectedArticleSlug == slug) {
                selectedArticle = result.getOrNull()
                articleLoadError = result.isFailure
            }
        } finally {
            articleLoading = false
        }
    }
    LaunchedEffect(tab) {
        // Keep the in-app badge live while the app is in use; refresh the
        // notification screen more frequently when its contents are visible.
        while (true) {
            alertItems = PublicMessagingService.alerts(context)
            delay(if (tab == PublicTab.ALERTS) 1_500L else 5_000L)
        }
    }
    LaunchedEffect(tab, locale, refreshKey) {
        if (tab == PublicTab.TEAM && teamsLoadedAtRefresh != refreshKey) {
            teamsLoading = true
            try {
                runCatching { withContext(Dispatchers.IO) { PublicApi.teams(locale) } }
                    .onSuccess { publicTeams = it; teamsLoadedAtRefresh = refreshKey }
            } finally { teamsLoading = false }
        }
        if (tab == PublicTab.COMPETITIONS && competitionsLoadedAtRefresh != refreshKey) {
            competitionsLoading = true
            competitionsError = false
            try {
                runCatching { withContext(Dispatchers.IO) { PublicApi.competitions(locale) } }
                    .onSuccess { publicCompetitions = it; competitionsLoadedAtRefresh = refreshKey }
                    .onFailure { competitionsError = true }
            } finally { competitionsLoading = false }
        }
    }

    MaterialTheme(
        colorScheme = darkColorScheme(background = Canvas, surface = Panel, primary = Accent, secondary = Mint, onSurface = PrimaryText),
        typography = Typography()
    ) {
      CompositionLocalProvider(LocalTextStyle provides MaterialTheme.typography.bodyMedium.copy(fontFamily = if (locale == "ar") Cairo else FontFamily.SansSerif)) {
      CompositionLocalProvider(LocalLayoutDirection provides if (locale == "ar") LayoutDirection.Rtl else LayoutDirection.Ltr) {
        Scaffold(
            containerColor = Canvas,
            contentWindowInsets = WindowInsets(0, 0, 0, 0),
            topBar = {
                if (selectedMatchId != null) {
                    MatchDetailsTopBar(locale, snapshot?.club, Modifier.statusBarsPadding(), onBack = { selectedMatchId = null }, onToggleLocale = {
                        locale = if (locale == "ar") "fr" else "ar"
                        preferences.edit().putString(PublicMessagingService.LOCALE, locale).apply()
                    })
                } else if (selectedArticleSlug != null) {
                    ArticleDetailsTopBar(locale, selectedArticle?.title, snapshot?.club, Modifier.statusBarsPadding(), onBack = {
                        selectedArticleSlug = null
                        selectedArticle = null
                    }, onToggleLocale = {
                        locale = if (locale == "ar") "fr" else "ar"
                        preferences.edit().putString(PublicMessagingService.LOCALE, locale).apply()
                    })
                } else {
                    PublicTopBar(locale, snapshot?.club, modifier = Modifier.statusBarsPadding(), onToggleLocale = {
                        locale = if (locale == "ar") "fr" else "ar"
                        preferences.edit().putString(PublicMessagingService.LOCALE, locale).apply()
                    })
                }
            },
            bottomBar = {
                if (selectedMatchId == null && selectedArticleSlug == null) {
                    PublicBottomBar(
                        tab,
                        locale,
                        liveMatch = snapshot?.matches?.any { it.status == "LIVE" } == true,
                        pendingAlerts = alertItems.size,
                        onSelect = { tab = it },
                        onMore = { showMoreSections = true }
                    )
                }
            }
        ) { padding ->
          Box(Modifier.fillMaxSize().then(if (selectedMatchId == null && selectedArticleSlug == null) Modifier.pullRefresh(pullRefreshState) else Modifier)) {
            AmbientMood(
                tab = tab,
                liveMatch = snapshot?.matches?.any { it.status == "LIVE" } == true,
                focused = selectedMatchId != null || selectedArticleSlug != null,
                modifier = Modifier.matchParentSize()
            )
            Box(Modifier.fillMaxSize().padding(padding)) {
                val data = snapshot
                if (selectedArticleSlug != null) {
                    when {
                        articleLoading -> ArticleLoadingScreen(locale)
                        articleLoadError || selectedArticle == null -> ArticleErrorScreen(locale) { articleRetry++ }
                        else -> ArticleReaderScreen(selectedArticle!!, locale)
                    }
                } else if (selectedMatchId != null) {
                    when {
                        matchDetailLoading -> MatchDetailLoading(locale)
                        matchDetailError || matchCenter == null -> MatchDetailError(locale) { matchDetailRetry++ }
                        else -> MatchDetailsScreen(matchCenter!!, locale, data?.club?.logo)
                    }
                } else if (data == null && loading) LoadingScreen(locale)
                else if (data == null) ErrorScreen(locale, error) { refreshKey++ }
                else AnimatedContent(
                    targetState = tab,
                    transitionSpec = {
                        fadeIn(tween(190)) + slideInHorizontally(tween(220)) { it / 24 } togetherWith
                            fadeOut(tween(130)) + slideOutHorizontally(tween(180)) { -it / 24 }
                    },
                    label = "public-tab"
                ) { page ->
                    when (page) {
                        PublicTab.HOME -> HomeScreen(data, locale, onMatch = { id ->
                            selectedMatchId = id
                        }, onArticle = { slug -> selectedArticleSlug = slug }, onTab = { tab = it }, onReel = { selectedReel = it })
                        PublicTab.TEAM -> TeamsScreen(publicTeams, teamsLoading, locale)
                        PublicTab.MATCHES -> MatchesScreen(data, locale) { id -> selectedMatchId = id }
                        PublicTab.COMPETITIONS -> CompetitionsScreen(publicCompetitions, competitionsLoading, competitionsError, locale) { refreshKey++ }
                        PublicTab.GALLERY -> MediaScreen(data, locale, onReel = { selectedReel = it }, onAlbum = { id -> scope.launch { selectedAlbum = withContext(Dispatchers.IO) { PublicApi.album(id, locale) } } }, onPhoto = { selectedPhoto = it }, onVideo = { selectedVideo = it })
                        PublicTab.NEWS -> NewsScreen(data, locale) { slug -> selectedArticleSlug = slug }
                        PublicTab.CLUB -> ClubScreen(data, locale)
                        PublicTab.ALERTS -> AlertsScreen(alertItems, locale, onDismiss = { item -> PublicMessagingService.dismiss(context, item.id); alertItems = PublicMessagingService.alerts(context) })
                    }
                }
                if (selectedMatchId == null && selectedArticleSlug == null && data != null && error) Text(L(locale, "تعذر تحديث بعض البيانات · نعرض آخر محتوى محمّل", "Mise à jour impossible · affichage des derniers contenus reçus"), Modifier.align(Alignment.BottomCenter).padding(8.dp).clip(CircleShape).background(PanelRaised).padding(horizontal = 12.dp, vertical = 7.dp), color = Gold, fontSize = 10.sp)
            }
            if (selectedMatchId == null && selectedArticleSlug == null) PullRefreshIndicator(refreshing, pullRefreshState, Modifier.align(Alignment.TopCenter), backgroundColor = Panel, contentColor = Accent)
          }
        }
      }
      }
    }

    if (showMoreSections) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { showMoreSections = false },
            sheetState = sheetState,
            containerColor = Panel,
            contentColor = PrimaryText,
            dragHandle = { BottomSheetDefaults.DragHandle(color = SecondaryText.copy(alpha = .55f)) }
        ) {
            Column(
                Modifier.fillMaxWidth().navigationBarsPadding().padding(start = 20.dp, end = 20.dp, top = 2.dp, bottom = 22.dp),
                verticalArrangement = Arrangement.spacedBy(9.dp)
            ) {
                Text(L(locale, "اكتشف النادي", "Explorer le club"), color = PrimaryText, fontSize = 19.sp, fontWeight = FontWeight.Black)
                Text(L(locale, "كل أخبار الفريق ومحتواه في مكان واحد", "Toutes les actualités et contenus du club au même endroit"), color = SecondaryText, fontSize = 11.sp)
                listOf(PublicTab.TEAM, PublicTab.NEWS, PublicTab.ALERTS).forEach { destination ->
                    val selected = tab == destination
                    Surface(
                        onClick = {
                            showMoreSections = false
                            tab = destination
                        },
                        modifier = Modifier.fillMaxWidth(),
                        color = if (selected) Accent.copy(alpha = .13f) else PanelRaised,
                        shape = RoundedCornerShape(17.dp),
                        border = BorderStroke(1.dp, if (selected) Accent.copy(alpha = .35f) else Hairline)
                    ) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Box(Modifier.size(37.dp).clip(RoundedCornerShape(12.dp)).background(if (selected) Accent.copy(alpha = .18f) else Glass), contentAlignment = Alignment.Center) {
                                AppIcon(destination.icon(selected), destination.label(locale), if (selected) Mint else SecondaryText, Modifier.size(19.dp))
                            }
                            Text(destination.label(locale), modifier = Modifier.weight(1f), color = if (selected) PrimaryText else SecondaryText, fontSize = 13.sp, fontWeight = if (selected) FontWeight.Black else FontWeight.Bold)
                            if (destination == PublicTab.ALERTS && alertItems.isNotEmpty()) {
                                Box(Modifier.clip(CircleShape).background(Accent).padding(horizontal = 8.dp, vertical = 4.dp)) {
                                    Text(alertItems.size.coerceAtMost(99).toString(), color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black)
                                }
                            }
                            AppIcon(
                                if (selected) R.drawable.iconly_tick_square
                                else if (locale == "ar") R.drawable.iconly_arrow_left else R.drawable.iconly_arrow_right,
                                null,
                                if (selected) Mint else SecondaryText,
                                Modifier.size(15.dp)
                            )
                        }
                    }
                }
            }
        }
    }

    selectedAlbum?.let { AlbumDialog(it, locale, onPhoto = { selectedPhoto = it }, onVideo = { selectedVideo = it }, onDismiss = { selectedAlbum = null }) }
    selectedPhoto?.let { photo -> Dialog(onDismissRequest = { selectedPhoto = null }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Color.Black).clickable { selectedPhoto = null }, contentAlignment = Alignment.Center) {
            AsyncImage(model = photo.url, contentDescription = photo.caption.orEmpty(), modifier = Modifier.fillMaxWidth(), contentScale = ContentScale.Fit)
        }
    } }
    selectedVideo?.let { video -> VideoDialog(video) { selectedVideo = null } }
    selectedReel?.let { reel -> SocialReelDialog(reel, locale, { selectedReel = null }, { openUrl(reel.url, context) }) }

}

@Composable
private fun AmbientMood(tab: PublicTab, liveMatch: Boolean, focused: Boolean, modifier: Modifier = Modifier) {
    val targetAlpha = when {
        liveMatch -> .13f
        focused -> .105f
        tab == PublicTab.MATCHES -> .09f
        tab == PublicTab.HOME -> .075f
        else -> .052f
    }
    val glowAlpha by animateFloatAsState(targetValue = targetAlpha, animationSpec = tween(durationMillis = 420), label = "ambient-mood")
    Box(modifier.drawBehind {
        drawRect(Canvas)

        // Draw glows directly into the screen canvas. Layered background boxes
        // can leave rectangular compositing patches on some Android GPUs.
        val topCenter = Offset(size.width - 100.dp.toPx(), 80.dp.toPx())
        val topRadius = 200.dp.toPx()
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(Accent.copy(alpha = glowAlpha), Accent.copy(alpha = glowAlpha * .22f), Color.Transparent),
                center = topCenter,
                radius = topRadius
            ),
            radius = topRadius,
            center = topCenter
        )

        val bottomCenter = Offset(30.dp.toPx(), size.height - 20.dp.toPx())
        val bottomRadius = 160.dp.toPx()
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(Accent.copy(alpha = glowAlpha * .42f), Color.Transparent),
                center = bottomCenter,
                radius = bottomRadius
            ),
            radius = bottomRadius,
            center = bottomCenter
        )
    })
}

@Composable
private fun PublicTopBar(locale: String, club: PublicClub?, modifier: Modifier = Modifier, onToggleLocale: () -> Unit) {
    Row(Modifier.fillMaxWidth().background(Brush.verticalGradient(listOf(Panel.copy(alpha = .97f), Canvas.copy(alpha = .98f)))).then(modifier).padding(horizontal = 17.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(45.dp).clip(CircleShape).background(Glass).border(1.dp, Accent.copy(alpha = .34f), CircleShape).padding(5.dp), contentAlignment = Alignment.Center) {
            AsyncImage(model = club?.logo ?: R.drawable.esh_logo, contentDescription = "ESH", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(club?.shortName ?: "ESH", color = PrimaryText, fontSize = 16.sp, fontWeight = FontWeight.Black, letterSpacing = 1.3.sp, maxLines = 1)
            Text(club?.name ?: L(locale, "الجمعية الرياضية أمل سيدي حسني", "Association Sportive Espoir Sidi Hosni"), color = SecondaryText, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Surface(onClick = onToggleLocale, shape = RoundedCornerShape(13.dp), color = Color.Transparent, border = BorderStroke(1.dp, Accent.copy(alpha = .22f)), modifier = Modifier.siteGlass(RoundedCornerShape(13.dp))) {
            Row(Modifier.height(38.dp).padding(horizontal = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                AppIcon(PublicIcons.Language, null, Accent, Modifier.size(16.dp))
                Text(if (locale == "ar") "FR" else "ع", color = PrimaryText, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

@Composable
private fun MatchDetailsTopBar(locale: String, club: PublicClub?, modifier: Modifier, onBack: () -> Unit, onToggleLocale: () -> Unit) {
    Row(Modifier.fillMaxWidth().background(Brush.verticalGradient(listOf(Panel.copy(alpha = .97f), Canvas.copy(alpha = .98f)))).then(modifier).padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        HeaderAction(if (locale == "ar") R.drawable.iconly_arrow_right else R.drawable.iconly_arrow_left, L(locale, "رجوع", "Retour"), onBack)
        Box(Modifier.size(39.dp).clip(CircleShape).background(Glass).border(1.dp, Hairline, CircleShape).padding(4.dp), contentAlignment = Alignment.Center) {
            AsyncImage(model = club?.logo ?: R.drawable.esh_logo, contentDescription = "ESH", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(L(locale, "تفاصيل المباراة", "Détails du match"), color = PrimaryText, fontSize = 14.sp, fontWeight = FontWeight.Black, maxLines = 1)
            Text(club?.shortName ?: "ESH", color = SecondaryText, fontSize = 9.sp, maxLines = 1)
        }
        Surface(modifier = Modifier.height(38.dp).siteGlass(RoundedCornerShape(13.dp)).noRippleClickable(onToggleLocale), shape = RoundedCornerShape(13.dp), color = Color.Transparent, border = BorderStroke(1.dp, Accent.copy(alpha = .22f))) {
            Row(Modifier.padding(horizontal = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                AppIcon(PublicIcons.Language, null, Accent, Modifier.size(16.dp))
                Text(if (locale == "ar") "FR" else "ع", color = PrimaryText, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

@Composable
private fun ArticleDetailsTopBar(locale: String, title: String?, club: PublicClub?, modifier: Modifier, onBack: () -> Unit, onToggleLocale: () -> Unit) {
    Row(Modifier.fillMaxWidth().background(Brush.verticalGradient(listOf(Panel.copy(alpha = .98f), Canvas.copy(alpha = .99f)))).then(modifier).padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        HeaderAction(if (locale == "ar") R.drawable.iconly_arrow_right else R.drawable.iconly_arrow_left, L(locale, "رجوع للأخبار", "Retour aux actualités"), onBack)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(L(locale, "قراءة الخبر", "Lecture"), color = SecondaryText, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            Text(title ?: L(locale, "أخبار النادي", "Actualités du club"), color = PrimaryText, fontSize = 13.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Surface(modifier = Modifier.height(38.dp).siteGlass(RoundedCornerShape(13.dp)).noRippleClickable(onToggleLocale), shape = RoundedCornerShape(13.dp), color = Color.Transparent, border = BorderStroke(1.dp, Accent.copy(alpha = .22f))) {
            Row(Modifier.padding(horizontal = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                AppIcon(PublicIcons.Language, null, Accent, Modifier.size(16.dp))
                Text(if (locale == "ar") "FR" else "ع", color = PrimaryText, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

@Composable
private fun HeaderAction(icon: Int, label: String, onClick: () -> Unit, selected: Boolean = false) {
    Surface(modifier = Modifier.size(38.dp).siteGlass(RoundedCornerShape(13.dp), accentGlow = selected).noRippleClickable(onClick), shape = RoundedCornerShape(13.dp), color = Color.Transparent, border = BorderStroke(1.dp, if (selected) Accent.copy(alpha = .25f) else Hairline)) {
        Box(contentAlignment = Alignment.Center) { AppIcon(icon, label, if (selected) Mint else PrimaryText, Modifier.size(19.dp)) }
    }
}

@Composable
private fun AppIcon(resource: Int, description: String?, tint: Color, modifier: Modifier = Modifier) {
    val precolored = resource == R.drawable.iconly_calendar_filled
    Image(painter = painterResource(resource), contentDescription = description, modifier = modifier, colorFilter = if (precolored) null else ColorFilter.tint(tint))
}

private fun Modifier.noRippleClickable(onClick: () -> Unit): Modifier = composed {
    val interactionSource = remember { MutableInteractionSource() }
    clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
}

@Composable
private fun PublicBottomBar(selected: PublicTab, locale: String, liveMatch: Boolean, pendingAlerts: Int, onSelect: (PublicTab) -> Unit, onMore: () -> Unit) {
    val tabs = remember { listOf(PublicTab.HOME, PublicTab.MATCHES, PublicTab.COMPETITIONS, PublicTab.GALLERY, PublicTab.CLUB) }
    val moreSelected = selected == PublicTab.TEAM || selected == PublicTab.NEWS || selected == PublicTab.ALERTS
    Surface(
        modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 13.dp, vertical = 7.dp).siteGlass(RoundedCornerShape(24.dp), accentGlow = selected == PublicTab.HOME),
        color = Color.Transparent,
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, Hairline),
        shadowElevation = 18.dp
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 5.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            tabs.forEach { item ->
                val active = selected == item
                Column(Modifier.weight(1f).clip(RoundedCornerShape(15.dp)).noRippleClickable { onSelect(item) }.heightIn(min = 48.dp).padding(horizontal = 2.dp, vertical = 5.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Box(Modifier.size(26.dp), contentAlignment = Alignment.Center) {
                            AppIcon(item.icon(active), item.label(locale), if (active) Mint else SecondaryText, Modifier.size(if (item == PublicTab.MATCHES) 21.dp else 20.dp))
                            if (item == PublicTab.MATCHES && liveMatch) Box(Modifier.align(Alignment.TopEnd).size(7.dp).clip(CircleShape).background(Accent).border(1.dp, PanelRaised, CircleShape))
                        }
                        if (active) Text(item.label(locale), color = PrimaryText, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1, softWrap = false)
                    }
            }
            Column(Modifier.weight(1f).clip(RoundedCornerShape(15.dp)).noRippleClickable(onMore).heightIn(min = 48.dp).padding(horizontal = 2.dp, vertical = 5.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Box(Modifier.size(22.dp), contentAlignment = Alignment.Center) {
                        AppIcon(PublicIcons.More, L(locale, "المزيد", "Plus"), if (moreSelected) Mint else SecondaryText, Modifier.size(20.dp))
                        if (pendingAlerts > 0) Box(Modifier.align(Alignment.TopEnd).size(7.dp).clip(CircleShape).background(Accent).border(1.dp, PanelRaised, CircleShape))
                    }
                    if (moreSelected) Text(L(locale, "المزيد", "Plus"), color = PrimaryText, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1)
            }
        }
    }
}

@Composable
private fun HomeScreen(data: PublicSnapshot, locale: String, onMatch: (String) -> Unit, onArticle: (String) -> Unit, onTab: (PublicTab) -> Unit, onReel: (PublicReel) -> Unit) {
    val featured = data.matches.firstOrNull { it.status == "LIVE" } ?: data.nextMatch ?: data.matches.firstOrNull()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 22.dp), verticalArrangement = Arrangement.spacedBy(17.dp)) {
        item {
            Box(Modifier.fillMaxWidth().height(214.dp).clip(RoundedCornerShape(28.dp)).background(Brush.linearGradient(listOf(Accent.copy(alpha = .22f), PanelRaised, Canvas))).border(1.dp, Accent.copy(alpha = .25f), RoundedCornerShape(28.dp))) {
                if (data.club.hero != null) AsyncImage(model = data.club.hero, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alpha = .32f)
                Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Color(0xF0111315), Color(0xA0111315), Color.Transparent))))
                Box(Modifier.align(Alignment.TopEnd).padding(22.dp).size(132.dp).clip(CircleShape).background(Brush.radialGradient(listOf(Accent.copy(alpha = .22f), Color.Transparent))))
                Column(Modifier.align(Alignment.CenterStart).padding(horizontal = 21.dp, vertical = 17.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        Box(Modifier.size(6.dp).clip(CircleShape).background(Mint))
                        Text(L(locale, "من قلب سيدي حسني", "AU CŒUR DE SIDI HOSNI"), color = Mint, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = .8.sp)
                    }
                    Text(data.club.name, color = PrimaryText, fontSize = 21.sp, lineHeight = 29.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(L(locale, "قريبون من الفريق، في كل لحظة", "Au plus près de l’équipe, à chaque instant"), color = PrimaryText.copy(alpha = .78f), fontSize = 11.sp)
                    Surface(
                        modifier = Modifier.clip(CircleShape).noRippleClickable { featured?.let { onMatch(it.id) } ?: onTab(PublicTab.MATCHES) },
                        color = Accent,
                        shape = CircleShape
                    ) {
                        Row(Modifier.padding(horizontal = 11.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            AppIcon(PublicIcons.Match, null, Color.White, Modifier.size(14.dp))
                            Text(
                                L(locale, if (featured?.status == "LIVE") "تابع المباراة الآن" else "المباريات والنتائج", if (featured?.status == "LIVE") "Suivre le match en direct" else "Matchs et résultats"),
                                color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1
                            )
                            AppIcon(if (locale == "ar") R.drawable.iconly_arrow_left else R.drawable.iconly_arrow_right, null, Color.White, Modifier.size(12.dp))
                        }
                    }
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
        val latestResult = data.results.firstOrNull()
        if (latestResult != null && latestResult.id != featured?.id) item {
            SectionHeading(L(locale, "آخر نتيجة", "Dernier résultat"), PublicIcons.Trophy, locale, action = { onTab(PublicTab.MATCHES) })
            MatchCard(latestResult, locale, clubLogo = data.club.logo, onClick = { onMatch(latestResult.id) })
        }
        if (data.trainings.isNotEmpty()) item {
            SectionHeading(L(locale, "التدريبات القادمة", "Prochains entraînements"), PublicIcons.Training, locale, action = { onTab(PublicTab.CLUB) })
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) { items(data.trainings.take(4), key = { it.id }) { TrainingCard(it, locale) } }
        }
        if (data.news.isNotEmpty()) item {
            SectionHeading(L(locale, "آخر الأخبار", "Dernières actualités"), PublicIcons.News, locale, action = { onTab(PublicTab.NEWS) })
            NewsCard(data.news.first(), locale, onClick = { onArticle(data.news.first().slug) })
        }
        if (data.reels.isNotEmpty()) item {
            SectionHeading(L(locale, "لقطات النادي", "Les vidéos du club"), PublicIcons.Play, locale, action = { onTab(PublicTab.GALLERY) })
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                items(data.reels.take(6), key = { it.id }) { reel -> ReelCard(reel, locale, Modifier.width(154.dp), onClick = { onReel(reel) }) }
            }
        }
        if (data.albums.isNotEmpty()) item {
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
        item { ScreenHeading(L(locale, "الفريق", "Effectifs"), L(locale, "فئات النادي ولاعبوها", "Les équipes et leurs joueurs"), PublicIcons.Team) }
        if (isLoading && teams.isEmpty()) item { LoadingInline(locale) }
        if (!isLoading && teams.isEmpty()) item { EmptyState(L(locale, "تعذر تحميل فئات الفريق. اسحب للأسفل للمحاولة مجددًا.", "Chargement impossible. Tirez vers le bas pour réessayer.")) }
        items(teams, key = { it.id }) { team ->
            Surface(Modifier.siteGlass(RoundedCornerShape(19.dp)), color = Color.Transparent, shape = RoundedCornerShape(19.dp), border = BorderStroke(1.dp, Hairline)) {
                Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(43.dp).clip(RoundedCornerShape(14.dp)).background(Accent.copy(alpha = .13f)), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Team, null, Accent, Modifier.size(21.dp)) }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(categoryLabel(locale, team.category), color = PrimaryText, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp)
                        team.description?.takeIf { it.isNotBlank() }?.let { Text(it, color = SecondaryText, fontSize = 10.sp, maxLines = 2, overflow = TextOverflow.Ellipsis) }
                        if (team.birthYearFrom != null || team.birthYearTo != null) Text("${team.birthYearFrom ?: "…"} – ${team.birthYearTo ?: "…"}", color = Gold, fontSize = 10.sp)
                    }
                    Text(if (locale == "fr") "${team.playerCount} ${if (team.playerCount == 1) "joueur" else "joueurs"}" else "${team.playerCount} لاعب", color = Mint, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                }
            }
        }
    }
}

@Composable
private fun CompetitionsScreen(competitions: List<PublicCompetition>, isLoading: Boolean, hadError: Boolean, locale: String, onRetry: () -> Unit) {
    val seasons = remember(competitions) {
        competitions.distinctBy { it.seasonId.ifBlank { it.season } }
            .sortedWith(compareByDescending<PublicCompetition> { it.isCurrentSeason }.thenByDescending { it.season })
    }
    var activeType by remember { mutableStateOf("LEAGUE") }
    var activeCategory by remember { mutableStateOf("SENIOR") }
    var activeSeasonId by remember(competitions) {
        mutableStateOf(seasons.firstOrNull { it.isCurrentSeason }?.seasonId?.takeIf(String::isNotBlank) ?: seasons.firstOrNull()?.seasonId.orEmpty())
    }
    val selected = competitions.firstOrNull {
        it.type == activeType && it.category.equals(activeCategory, true)
            && (it.seasonId == activeSeasonId || (activeSeasonId.isBlank() && it.season == seasons.firstOrNull()?.season))
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 28.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        item {
            ScreenHeading(
                L(locale, "المسابقات والبطولات", "Compétitions & tournois"),
                L(locale, "ترتيب النادي ومشواره في المنافسات الرسمية", "Classements et parcours du club dans les compétitions officielles"),
                PublicIcons.Trophy
            )
        }
        if (isLoading && competitions.isEmpty()) item { LoadingInline(locale) }
        if (!isLoading && competitions.isEmpty()) item {
            EmptyState(L(locale, if (hadError) "تعذر تحديث المسابقات. تحقق من الاتصال ثم أعد المحاولة." else "لا توجد مسابقات منشورة حالياً.", if (hadError) "Mise à jour impossible. Vérifiez la connexion puis réessayez." else "Aucune compétition publiée pour le moment."))
            if (hadError) itemRetry(onRetry, locale)
        }
        if (competitions.isNotEmpty()) {
            item {
                Surface(Modifier.siteGlass(RoundedCornerShape(18.dp)), color = Color.Transparent, shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, Hairline)) {
                    Row(Modifier.fillMaxWidth().padding(4.dp), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        listOf("LEAGUE" to L(locale, "الدوري", "Championnat"), "CUP" to L(locale, "كأس الجزائر", "Coupe d’Algérie")).forEach { (type, label) ->
                            val active = activeType == type
                            Surface(
                                onClick = { activeType = type }, modifier = Modifier.weight(1f),
                                color = if (active) Accent else Color.Transparent,
                                shape = RoundedCornerShape(14.dp)
                            ) {
                                Row(Modifier.padding(horizontal = 12.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                                    AppIcon(if (type == "CUP") PublicIcons.Trophy else PublicIcons.Shield, null, if (active) Color.White else SecondaryText, Modifier.size(15.dp))
                                    Spacer(Modifier.width(7.dp))
                                    Text(label, color = if (active) Color.White else SecondaryText, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1)
                                }
                            }
                        }
                    }
                }
            }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp), contentPadding = PaddingValues(end = 2.dp)) {
                    items(listOf("SENIOR", "U20", "U17", "U15")) { category ->
                        FilterChip(
                            selected = activeCategory == category,
                            onClick = { activeCategory = category },
                            label = { Text(categoryLabel(locale, category), fontSize = 10.sp, fontWeight = FontWeight.Bold) },
                            shape = CircleShape,
                            border = FilterChipDefaults.filterChipBorder(enabled = true, selected = activeCategory == category, borderColor = Hairline, selectedBorderColor = Accent.copy(alpha = .6f)),
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Accent.copy(alpha = .16f), selectedLabelColor = Accent, containerColor = Panel, labelColor = SecondaryText)
                        )
                    }
                }
            }
            if (seasons.isNotEmpty()) item {
                Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Text(L(locale, "الموسم الرياضي", "Saison sportive"), color = SecondaryText, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp), contentPadding = PaddingValues(end = 2.dp)) {
                        items(seasons, key = { it.seasonId.ifBlank { it.season } }) { season ->
                            val id = season.seasonId.ifBlank { season.season }
                            FilterChip(
                                selected = activeSeasonId == id,
                                onClick = { activeSeasonId = id },
                                label = { Text(season.season + if (season.isCurrentSeason) " · ${L(locale, "الحالي", "En cours")}" else "", fontSize = 10.sp, fontWeight = FontWeight.Bold) },
                                shape = CircleShape,
                                border = FilterChipDefaults.filterChipBorder(enabled = true, selected = activeSeasonId == id, borderColor = Hairline, selectedBorderColor = Gold.copy(alpha = .6f)),
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Gold.copy(alpha = .13f), selectedLabelColor = Gold, containerColor = Panel, labelColor = SecondaryText)
                            )
                        }
                    }
                }
            }
            if (selected == null) {
                item { EmptyState(L(locale, "لا توجد مسابقة مسجلة لهذه الفئة في هذا الموسم.", "Aucune compétition pour cette catégorie et cette saison.")) }
            } else {
                item { CompetitionBanner(selected, locale) }
                if (selected.type == "CUP") {
                    if (selected.bracket.isEmpty()) item { EmptyState(L(locale, "لم يُنشر مسار الكأس لهذه المسابقة بعد.", "Le tableau de la coupe n’a pas encore été publié.")) }
                    else item { CupBracketView(selected.bracket, locale) }
                } else {
                    if (selected.standings.isEmpty()) item { EmptyState(L(locale, "لم يُنشر ترتيب هذه المسابقة بعد.", "Le classement n’a pas encore été publié.")) }
                    else item { CompetitionStandingsTable(selected.standings, locale) }
                }
            }
        }
    }
}

@Composable
private fun CompetitionBanner(competition: PublicCompetition, locale: String) {
    Surface(Modifier.siteGlass(RoundedCornerShape(22.dp), accentGlow = true), color = Color.Transparent, shape = RoundedCornerShape(22.dp), border = BorderStroke(1.dp, Hairline), shadowElevation = 8.dp) {
        Box(Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(Accent.copy(alpha = .12f), Panel, PanelRaised)))) {
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(13.dp)) {
                Box(Modifier.size(54.dp).clip(RoundedCornerShape(16.dp)).background(Color.White.copy(alpha = .07f)).border(1.dp, Hairline, RoundedCornerShape(16.dp)).padding(8.dp), contentAlignment = Alignment.Center) {
                    if (!competition.logo.isNullOrBlank()) AsyncImage(model = competition.logo, contentDescription = competition.name, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                    else AppIcon(if (competition.type == "CUP") PublicIcons.Trophy else PublicIcons.Shield, null, if (competition.type == "CUP") Gold else Accent, Modifier.size(27.dp))
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("${categoryLabel(locale, competition.category)} · ${competition.season}", color = Gold, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold)
                    Text(competition.name, color = PrimaryText, fontSize = 15.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    competition.organization?.takeIf { it.isNotBlank() }?.let { Text(it, color = SecondaryText, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                }
                Box(Modifier.size(8.dp).clip(CircleShape).background(if (competition.status == "ACTIVE") Mint else Gold))
            }
        }
    }
}

@Composable
private fun CompetitionStandingsTable(standings: List<PublicStanding>, locale: String) {
    Surface(Modifier.siteGlass(RoundedCornerShape(20.dp)), color = Color.Transparent, shape = RoundedCornerShape(20.dp), border = BorderStroke(1.dp, Hairline)) {
        Column(Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(PanelRaised).padding(horizontal = 8.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("#", color = SecondaryText, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(28.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                Text(L(locale, "النادي / الفريق", "Club / équipe"), color = SecondaryText, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                listOf(L(locale, "لعب", "J"), L(locale, "فاز", "V"), L(locale, "تعادل", "N"), L(locale, "خسر", "D")).forEach { label ->
                    Text(label, color = SecondaryText, fontSize = 8.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(27.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                }
                Text(L(locale, "ن", "Pts"), color = Gold, fontSize = 9.sp, fontWeight = FontWeight.Black, modifier = Modifier.width(34.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
            standings.forEachIndexed { index, team ->
                val selected = team.isOurClub
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(11.dp)).background(if (selected) Accent.copy(alpha = .12f) else if (index % 2 == 1) Color.White.copy(alpha = .018f) else Color.Transparent).padding(horizontal = 8.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.width(28.dp), contentAlignment = Alignment.Center) {
                        Text(team.rank.toString(), color = if (selected) Accent else if (team.rank == 1) Gold else SecondaryText, fontSize = 10.sp, fontWeight = FontWeight.Black)
                    }
                    Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Box(Modifier.size(25.dp).clip(CircleShape).background(Glass).border(1.dp, if (selected) Accent.copy(alpha = .4f) else Hairline, CircleShape).padding(3.dp), contentAlignment = Alignment.Center) {
                            if (!team.teamLogo.isNullOrBlank()) AsyncImage(model = team.teamLogo, contentDescription = team.teamName, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                            else AppIcon(PublicIcons.Shield, null, if (selected) Accent else SecondaryText, Modifier.size(15.dp))
                        }
                        Text(team.teamName, color = if (selected) PrimaryText else SecondaryText, fontSize = 9.sp, fontWeight = if (selected) FontWeight.ExtraBold else FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    listOf(team.played, team.won, team.drawn, team.lost).forEachIndexed { statIndex, value ->
                        Text(value.toString(), color = if (statIndex == 1) Mint else PrimaryText, fontSize = 9.sp, fontWeight = if (statIndex == 1) FontWeight.Bold else FontWeight.Medium, modifier = Modifier.width(27.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    }
                    Text(team.points.toString(), color = Gold, fontSize = 11.sp, fontWeight = FontWeight.Black, modifier = Modifier.width(34.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                }
                if (index < standings.lastIndex) Box(Modifier.fillMaxWidth().padding(horizontal = 8.dp).height(1.dp).background(Hairline.copy(alpha = .55f)))
            }
            Row(Modifier.fillMaxWidth().padding(top = 7.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) { Box(Modifier.size(7.dp).clip(CircleShape).background(Accent)); Text(L(locale, "فريق الجمعية", "Notre club"), color = SecondaryText, fontSize = 8.sp) }
                Text(L(locale, "له/عليه وفارق الأهداف متاحة في جدول الموقع العام.", "Les buts pour/contre et la différence sont détaillés sur le site."), color = SecondaryText, fontSize = 8.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun CupBracketView(rounds: List<PublicCupRound>, locale: String) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(end = 3.dp)) {
        items(rounds, key = { it.key }) { round ->
            val isFinal = round.key == "FINAL"
            Surface(Modifier.width(250.dp).siteGlass(RoundedCornerShape(18.dp), accentGlow = isFinal), color = Color.Transparent, shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, if (isFinal) Accent.copy(alpha = .38f) else Hairline)) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        AppIcon(if (isFinal) PublicIcons.Trophy else PublicIcons.Shield, null, if (isFinal) Gold else Accent, Modifier.size(17.dp))
                        Text(round.label, color = if (isFinal) Gold else PrimaryText, fontSize = 12.sp, fontWeight = FontWeight.Black)
                        Spacer(Modifier.weight(1f))
                        Text(round.matches.size.toString(), color = SecondaryText, fontSize = 9.sp)
                    }
                    if (round.matches.isEmpty()) Text(L(locale, "لا توجد مباريات في هذا الدور", "Aucun match pour ce tour"), color = SecondaryText, fontSize = 10.sp, modifier = Modifier.padding(vertical = 8.dp))
                    round.matches.forEach { match ->
                        Surface(Modifier.siteGlass(RoundedCornerShape(13.dp)), color = Color.Transparent, shape = RoundedCornerShape(13.dp), border = BorderStroke(1.dp, Hairline)) {
                            Column(Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                                CupBracketTeamRow(match.home, Modifier.fillMaxWidth())
                                Box(Modifier.fillMaxWidth().height(1.dp).background(Hairline))
                                CupBracketTeamRow(match.away, Modifier.fillMaxWidth())
                                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                    Text(statusLabel(locale, match.status, match.date), color = statusForeground(match.status), fontSize = 8.sp, fontWeight = FontWeight.Bold)
                                    Spacer(Modifier.weight(1f))
                                    match.date?.let { Text(formatDate(it, locale), color = SecondaryText, fontSize = 8.sp) }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CupBracketTeamRow(team: PublicCupTeam, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        Box(Modifier.size(23.dp).clip(CircleShape).background(Glass).padding(3.dp), contentAlignment = Alignment.Center) {
            if (!team.logo.isNullOrBlank()) AsyncImage(model = team.logo, contentDescription = team.name, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
            else AppIcon(PublicIcons.Shield, null, if (team.isOurClub) Accent else SecondaryText, Modifier.size(15.dp))
        }
        Text(team.name, color = if (team.isOurClub) PrimaryText else SecondaryText, fontSize = 9.sp, fontWeight = if (team.isOurClub) FontWeight.ExtraBold else FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        team.score?.let { Text(it.toString(), color = PrimaryText, fontSize = 12.sp, fontWeight = FontWeight.Black) }
    }
}

@Composable
private fun ClubScreen(data: PublicSnapshot, locale: String) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        item {
            Box(Modifier.fillMaxWidth().height(250.dp).clip(RoundedCornerShape(27.dp)).background(Brush.linearGradient(listOf(Accent.copy(alpha = .28f), PanelRaised, Canvas)))) {
                data.club.hero?.let { hero -> AsyncImage(model = hero, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alpha = .52f) }
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Canvas.copy(alpha = .12f), Canvas.copy(alpha = .34f), Canvas.copy(alpha = .97f)))))
                Box(Modifier.align(Alignment.TopEnd).padding(20.dp).size(118.dp).clip(CircleShape).background(Accent.copy(alpha = .10f)))
                Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(19.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(Modifier.size(64.dp).clip(CircleShape).background(Color.White).border(2.dp, Accent.copy(alpha = .8f), CircleShape).padding(6.dp), contentAlignment = Alignment.Center) {
                            AsyncImage(model = data.club.logo ?: R.drawable.esh_logo, contentDescription = data.club.name, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                        }
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text("ESH  ·  SIDI HOSNI", color = Color.White.copy(alpha = .82f), fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.1.sp)
                            Text(data.club.shortName.ifBlank { "ESH" }, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    Text(data.club.name, color = Color.White.copy(alpha = .92f), fontSize = 13.sp, lineHeight = 19.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        item {
            Column(Modifier.fillMaxWidth().siteGlass(RoundedCornerShape(22.dp)).padding(17.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    Box(Modifier.size(34.dp).clip(RoundedCornerShape(11.dp)).background(Accent.copy(alpha = .12f)), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Club, null, Accent, Modifier.size(18.dp)) }
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(L(locale, "حكاية النادي", "Le club"), color = PrimaryText, fontWeight = FontWeight.Black, fontSize = 15.sp)
                        Text(L(locale, "فريق من سيدي حسني، يجمعنا شغف كرة القدم", "Le football et Sidi Hosni nous rassemblent"), color = SecondaryText, fontSize = 10.sp)
                    }
                }
                Box(Modifier.fillMaxWidth().height(1.dp).background(Hairline))
                Text(data.club.description?.takeIf { it.isNotBlank() } ?: L(locale, "الجمعية الرياضية أمل سيدي حسني لكرة القدم. نعمل بروح الفريق ونمثل مدينتنا في الميدان.", "L’Association Sportive Espoir Sidi Hosni fait vivre le football avec l’esprit d’équipe et représente sa ville sur le terrain."), color = PrimaryText.copy(alpha = .84f), fontSize = 13.sp, lineHeight = 22.sp)
            }
        }
        item {
            SectionHeading(L(locale, "ما يجمعنا", "Nos valeurs"), PublicIcons.Shield, locale)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(9.dp), contentPadding = PaddingValues(end = 2.dp)) {
                items(listOf(
                    L(locale, "التكوين", "Formation") to L(locale, "تطوير اللاعبين داخل الملعب وخارجه.", "Accompagner chaque joueur sur et en dehors du terrain."),
                    L(locale, "المنافسة", "Compétition") to L(locale, "تمثيل سيدي حسني بفخر في المنافسات.", "Porter les couleurs de Sidi Hosni avec fierté."),
                    L(locale, "روح الفريق", "Esprit d’équipe") to L(locale, "الاحترام والانضباط والعمل الجماعي.", "Cultiver le respect, la discipline et le collectif.")
                )) { (title, detail) ->
                    Column(Modifier.width(218.dp).siteGlass(RoundedCornerShape(19.dp)).padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                        Box(Modifier.size(34.dp).clip(RoundedCornerShape(11.dp)).background(Accent.copy(alpha = .12f)), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Shield, null, Accent, Modifier.size(17.dp)) }
                        Text(title, color = PrimaryText, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                        Text(detail, color = SecondaryText, fontSize = 10.sp, lineHeight = 16.sp, minLines = 2, maxLines = 3, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
        data.club.stadium?.takeIf { it.isNotBlank() }?.let { stadium -> item {
            Row(Modifier.fillMaxWidth().siteGlass(RoundedCornerShape(18.dp)).padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                Box(Modifier.size(39.dp).clip(RoundedCornerShape(13.dp)).background(Accent.copy(alpha = .12f)), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Club, null, Accent, Modifier.size(19.dp)) }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(L(locale, "ملعبنا", "Notre stade"), color = SecondaryText, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    Text(stadium, color = PrimaryText, fontSize = 12.sp, fontWeight = FontWeight.Bold, lineHeight = 18.sp)
                }
            }
        } }
        if (data.trainings.isNotEmpty()) item { SectionHeading(L(locale, "موعدنا القادم", "Prochains entraînements"), PublicIcons.Training, locale) }
        items(data.trainings, key = { "club-training-${it.id}" }) { TrainingCard(it, locale) }
    }
}

@Composable
private fun MatchesScreen(data: PublicSnapshot, locale: String, onMatch: (String) -> Unit) {
    var category by remember { mutableStateOf("ALL") }
    val filtered = data.matches.filter { categoryMatches(it.category, category) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeading(L(locale, "المباريات", "Matchs"), L(locale, "المواعيد والنتائج والأحداث المباشرة", "Calendrier, résultats et suivi en direct"), PublicIcons.Match) }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(listOf("ALL", "SENIOR", "U20", "U17", "U15")) { value ->
                    FilterChip(selected = category == value, onClick = { category = value }, label = { Text(categoryLabel(locale, value), fontSize = 11.sp, fontWeight = FontWeight.Bold) }, shape = CircleShape, border = FilterChipDefaults.filterChipBorder(enabled = true, selected = category == value, borderColor = Hairline, selectedBorderColor = Accent.copy(alpha = .5f)), colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Accent.copy(alpha = .18f), selectedLabelColor = Accent, containerColor = Panel, labelColor = SecondaryText))
                }
            }
        }
        val live = filtered.filter { it.status == "LIVE" }
        if (live.isNotEmpty()) item { SectionHeading(L(locale, "مباشر الآن", "En direct"), PublicIcons.Match, locale) }
        items(live, key = { "live-${it.id}" }) { MatchCard(it, locale, clubLogo = data.club.logo, onClick = { onMatch(it.id) }, featured = true) }
        item { SectionHeading(L(locale, "المواعيد القادمة", "Calendrier à venir"), PublicIcons.Calendar, locale) }
        items(filtered.filter { it.status == "SCHEDULED" }, key = { it.id }) { MatchCard(it, locale, clubLogo = data.club.logo, onClick = { onMatch(it.id) }) }
        item { SectionHeading(L(locale, "آخر النتائج", "Derniers résultats"), PublicIcons.Trophy, locale) }
        items(data.results.filter { categoryMatches(it.category, category) }, key = { "result-${it.id}" }) { MatchCard(it, locale, clubLogo = data.club.logo, onClick = { onMatch(it.id) }) }
        if (filtered.isEmpty() && data.results.isEmpty()) item { EmptyState(L(locale, "لا توجد مباريات منشورة حالياً", "Aucun match publié pour le moment")) }
    }
}

@Composable
private fun MediaScreen(data: PublicSnapshot, locale: String, onReel: (PublicReel) -> Unit, onAlbum: (String) -> Unit, onPhoto: (PublicPhoto) -> Unit, onVideo: (String) -> Unit) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { ScreenHeading(L(locale, "المعرض", "Galerie"), L(locale, "صور وفيديوهات الأمل داخل الملعب وخارجه", "Photos et vidéos d’Espoir, sur et en dehors du terrain"), PublicIcons.Media) }
        if (data.reels.isNotEmpty()) item {
            SectionHeading(L(locale, "لقطات النادي", "Les vidéos du club"), PublicIcons.Play, locale)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                items(data.reels, key = { it.id }) { reel -> ReelCard(reel, locale, Modifier.width(154.dp), onClick = { onReel(reel) }) }
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
private fun ReelCard(reel: PublicReel, locale: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val platform = reel.platform.lowercase(Locale.ROOT)
    val tones = when (platform) {
        "instagram" -> listOf(Accent.copy(alpha = .30f), PanelRaised, Canvas)
        "facebook" -> listOf(Accent.copy(alpha = .22f), PanelRaised, Canvas)
        else -> listOf(Accent.copy(alpha = .26f), PanelRaised, Canvas)
    }
    Surface(
        onClick = onClick,
        modifier = modifier.height(222.dp),
        color = Panel,
        shape = RoundedCornerShape(24.dp),
        shadowElevation = 8.dp
    ) {
        Box {
            Box(Modifier.fillMaxSize().background(Brush.linearGradient(tones)))
            Box(Modifier.align(Alignment.TopEnd).padding(top = 28.dp, end = 20.dp).size(92.dp).clip(CircleShape).background(Color.White.copy(alpha = .035f)))
            Box(Modifier.align(Alignment.BottomStart).padding(start = 14.dp, bottom = 70.dp).size(70.dp).clip(CircleShape).background(Accent.copy(alpha = .09f)))
            Box(Modifier.align(Alignment.Center).size(62.dp).clip(CircleShape).background(Color.White.copy(alpha = .13f)), contentAlignment = Alignment.Center) {
                AppIcon(PublicIcons.Play, null, Color.White, Modifier.size(30.dp))
            }
            Text(
                reel.platform.uppercase(Locale.ROOT),
                Modifier.align(Alignment.TopStart).padding(11.dp).clip(CircleShape).background(Color.Black.copy(alpha = .28f)).padding(horizontal = 9.dp, vertical = 5.dp),
                color = Color.White.copy(alpha = .9f), fontSize = 8.sp, fontWeight = FontWeight.Black, letterSpacing = .7.sp
            )
            Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = .72f)))).padding(horizontal = 12.dp, vertical = 13.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(reel.title, color = PrimaryText, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, maxLines = 2, overflow = TextOverflow.Ellipsis, lineHeight = 17.sp)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Box(Modifier.size(5.dp).clip(CircleShape).background(Mint))
                    Text(L(locale, "لقطة فيديو", "Vidéo du club"), color = Color.White.copy(alpha = .74f), fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
                }
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
        item { ScreenHeading(L(locale, "التنبيهات", "Notifications"), L(locale, "أهداف وتحديثات المباريات المباشرة", "Buts et mises à jour des matchs en direct"), PublicIcons.Alerts) }
        item { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.clip(CircleShape).background(Panel).padding(horizontal = 12.dp, vertical = 8.dp)) { Box(Modifier.size(7.dp).clip(CircleShape).background(Accent)); Text(L(locale, "إشعارات تطبيق الجمهور فقط", "Notifications de l’application ESH"), color = SecondaryText, fontSize = 10.sp) } }
        items(alerts, key = { it.id }) { alert ->
            Surface(Modifier.siteGlass(RoundedCornerShape(18.dp), accentGlow = true), color = Color.Transparent, shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, Hairline)) {
                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                    Box(Modifier.size(40.dp).clip(CircleShape).background(Accent.copy(alpha = .16f)), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Match, null, Accent, Modifier.size(20.dp)) }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(alert.title, color = PrimaryText, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text(alert.body, color = SecondaryText, fontSize = 11.sp)
                        Text(formatDate(alert.time.toString(), locale), color = Gold, fontSize = 9.sp)
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
    val finished = match.status == "FINISHED"
    val homeWon = finished && match.homeScore != null && match.awayScore != null && match.homeScore > match.awayScore
    val awayWon = finished && match.homeScore != null && match.awayScore != null && match.awayScore > match.homeScore
    Surface(Modifier.fillMaxWidth().siteGlass(RoundedCornerShape(22.dp), accentGlow = live || featured).noRippleClickable(onClick), color = Color.Transparent, shape = RoundedCornerShape(22.dp), border = BorderStroke(1.dp, if (live) Accent.copy(alpha = .48f) else if (finished) Hairline.copy(alpha = .9f) else Hairline)) {
        Column(Modifier.padding(if (featured) 16.dp else 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.clip(CircleShape).background(Glass).padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    AppIcon(PublicIcons.Shield, null, Gold, Modifier.size(12.dp))
                    Text(categoryLabel(locale, match.category ?: ""), color = Gold, fontSize = 8.sp, fontWeight = FontWeight.ExtraBold)
                }
                Spacer(Modifier.weight(1f))
                MatchStatusBadge(locale, match.status, match.date)
            }
            Row(Modifier.fillMaxWidth().padding(vertical = if (featured) 2.dp else 0.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                TeamBadge(match.home, if (match.isHomeFixture) clubLogo else match.opponentLogo, modifier = Modifier.weight(1f), featured = featured, isWinner = homeWon)
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    if (match.homeScore != null && match.awayScore != null) {
                        Row(Modifier.clip(RoundedCornerShape(13.dp)).background(if (finished) Canvas else Glass).padding(horizontal = if (featured) 13.dp else 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(match.homeScore.toString(), color = if (homeWon) Mint else PrimaryText, fontSize = if (featured) 27.sp else 22.sp, fontWeight = FontWeight.Black)
                            Text("–", color = if (live) Accent else SecondaryText, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                            Text(match.awayScore.toString(), color = if (awayWon) Mint else PrimaryText, fontSize = if (featured) 27.sp else 22.sp, fontWeight = FontWeight.Black)
                        }
                    } else Text("VS", color = Mint, fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
                    Text(if (live) L(locale, "مباراة مباشرة", "EN DIRECT") else if (finished) formatDate(match.date, locale) else formatClock(match.date), color = if (live) Accent else SecondaryText, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                }
                TeamBadge(match.away, if (match.isHomeFixture) match.opponentLogo else clubLogo, modifier = Modifier.weight(1f), featured = featured, isWinner = awayWon)
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Hairline))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                AppIcon(PublicIcons.Trophy, null, if (live) Gold else SecondaryText, Modifier.size(13.dp))
                Text(match.competition, color = SecondaryText, fontSize = 9.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                if (!live && !finished) Text(formatDate(match.date, locale), color = SecondaryText, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                AppIcon(if (locale == "ar") R.drawable.iconly_arrow_left else R.drawable.iconly_arrow_right, L(locale, "تفاصيل المباراة", "Détails du match"), if (finished) Mint else SecondaryText, Modifier.size(13.dp))
            }
        }
    }
}

@Composable
private fun TeamBadge(name: String, logo: String?, modifier: Modifier = Modifier, featured: Boolean = false, isWinner: Boolean = false) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(Modifier.size(if (featured) 46.dp else 39.dp).clip(CircleShape).background(if (isWinner) Mint.copy(alpha = .12f) else Glass).border(1.dp, if (isWinner) Mint.copy(alpha = .45f) else Hairline, CircleShape).padding(5.dp), contentAlignment = Alignment.Center) {
            if (!logo.isNullOrBlank()) AsyncImage(model = logo, contentDescription = name, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
            else Text(name.take(1).uppercase(), color = Accent, fontSize = 17.sp, fontWeight = FontWeight.Black)
        }
        Text(name, color = if (isWinner) PrimaryText else SecondaryText, fontSize = 9.sp, fontWeight = if (isWinner) FontWeight.ExtraBold else FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

@Composable
private fun MatchStatusBadge(locale: String, status: String, date: String) {
    val foreground = statusForeground(status)
    Row(Modifier.clip(CircleShape).background(statusBackground(status)).border(1.dp, foreground.copy(alpha = .22f), CircleShape).padding(horizontal = 9.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Box(Modifier.size(5.dp).clip(CircleShape).background(foreground))
        Text(statusLabel(locale, status, date), color = foreground, fontSize = 8.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1, softWrap = false)
    }
}

@Composable
private fun TrainingCard(training: PublicTraining, locale: String) {
    Surface(Modifier.width(245.dp).siteGlass(RoundedCornerShape(18.dp)), color = Color.Transparent, shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, Hairline)) {
        Row(Modifier.padding(13.dp), horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(RoundedCornerShape(13.dp)).background(Mint.copy(alpha = .12f)), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Training, null, Mint, Modifier.size(20.dp)) }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(categoryLabel(locale, training.category), color = PrimaryText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text("${formatDate(training.date, locale)} · ${formatClock(training.start)}", color = Gold, fontSize = 10.sp)
                Text(training.location ?: training.team, color = SecondaryText, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun NewsCard(article: PublicNews, locale: String, onClick: () -> Unit) {
    Surface(onClick = onClick, modifier = Modifier.fillMaxWidth().siteGlass(RoundedCornerShape(24.dp), accentGlow = true), color = Color.Transparent, shape = RoundedCornerShape(24.dp), shadowElevation = 12.dp, border = BorderStroke(1.dp, Hairline)) {
        Column {
            Box(Modifier.fillMaxWidth().height(176.dp).background(Brush.linearGradient(listOf(Accent.copy(alpha = .30f), PanelRaised, Canvas)))) {
                if (article.image != null) {
                    AsyncImage(model = article.image, contentDescription = article.title, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                } else {
                    Box(Modifier.align(Alignment.CenterEnd).padding(end = 24.dp).size(100.dp).clip(CircleShape).background(Accent.copy(alpha = .09f)))
                    AppIcon(PublicIcons.News, null, Color.White.copy(alpha = .52f), Modifier.align(Alignment.Center).size(42.dp))
                }
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = .16f), Color.Transparent, Color.Black.copy(alpha = .78f)))))
                Row(Modifier.align(Alignment.TopStart).fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                    article.category?.takeIf { it.isNotBlank() }?.let {
                        Text(it, Modifier.clip(CircleShape).background(Color.Black.copy(alpha = .48f)).padding(horizontal = 10.dp, vertical = 6.dp), color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Spacer(Modifier.weight(1f))
                    Text(formatDate(article.date, locale), Modifier.clip(CircleShape).background(Color.Black.copy(alpha = .48f)).padding(horizontal = 10.dp, vertical = 6.dp), color = Color.White.copy(alpha = .88f), fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
                }
                Text(L(locale, "أخبار النادي", "ACTUALITÉS DU CLUB"), Modifier.align(Alignment.BottomStart).padding(horizontal = 14.dp, vertical = 12.dp), color = Color.White.copy(alpha = .82f), fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            }
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(article.title, color = PrimaryText, fontSize = 17.sp, lineHeight = 24.sp, fontWeight = FontWeight.Black, maxLines = 3, overflow = TextOverflow.Ellipsis)
                Text(article.excerpt, color = SecondaryText, fontSize = 11.sp, lineHeight = 18.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
                Row(Modifier.fillMaxWidth().padding(top = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(L(locale, "اقرأ الخبر", "Lire l’actualité"), color = Mint, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
                    Spacer(Modifier.weight(1f))
                    Box(Modifier.size(31.dp).clip(CircleShape).background(Accent.copy(alpha = .12f)), contentAlignment = Alignment.Center) {
                        AppIcon(if (locale == "ar") R.drawable.iconly_arrow_left else R.drawable.iconly_arrow_right, null, Mint, Modifier.size(14.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun AlbumTile(album: PublicAlbum, locale: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(onClick = onClick, modifier = modifier.siteGlass(RoundedCornerShape(19.dp)), color = Color.Transparent, shape = RoundedCornerShape(19.dp), shadowElevation = 8.dp, border = BorderStroke(1.dp, Hairline)) {
        Column {
            Box(Modifier.fillMaxWidth().height(142.dp).background(PanelRaised)) {
                val cover = album.cover ?: album.photos.firstOrNull()?.url
                if (cover != null && !isVideo(cover)) AsyncImage(model = cover, contentDescription = album.name, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                else Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Accent.copy(alpha = .20f), PanelRaised))), contentAlignment = Alignment.Center) { AppIcon(if (cover != null) PublicIcons.Play else PublicIcons.Media, null, Color.White, Modifier.size(31.dp)) }
                Text(mediaCountLabel(locale, album.count), Modifier.align(Alignment.BottomEnd).padding(9.dp).clip(CircleShape).background(Color.Black.copy(alpha = .58f)).padding(horizontal = 9.dp, vertical = 5.dp), color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
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
        else Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Accent.copy(alpha = .20f), PanelRaised))), contentAlignment = Alignment.Center) { Box(Modifier.size(52.dp).clip(CircleShape).background(Accent), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Play, null, Color.White, Modifier.size(22.dp)) } }
    }
}

@Composable
private fun AnnouncementStrip(item: PublicAnnouncement, locale: String) {
    val urgent = item.priority.equals("URGENT", true) || item.priority.equals("HIGH", true)
    Surface(Modifier.siteGlass(RoundedCornerShape(17.dp), accentGlow = urgent), color = Color.Transparent, shape = RoundedCornerShape(17.dp), border = BorderStroke(1.dp, if (urgent) Accent.copy(alpha = .38f) else Hairline)) {
        Row(Modifier.fillMaxWidth().padding(13.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
            AppIcon(PublicIcons.Announcement, null, if (urgent) Accent else Gold, Modifier.size(19.dp))
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) { Text(item.title, color = PrimaryText, fontSize = 12.sp, fontWeight = FontWeight.Bold); Text(item.content, color = SecondaryText, fontSize = 10.sp, lineHeight = 16.sp, maxLines = 3, overflow = TextOverflow.Ellipsis) }
        }
    }
}

@Composable
private fun SectionHeading(title: String, icon: Int, locale: String, action: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        AppIcon(icon, null, Accent, Modifier.size(18.dp))
        Text(title, color = PrimaryText, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (action != null) Text(L(locale, "عرض الكل", "Tout voir"), Modifier.clip(CircleShape).clickable(onClick = action).padding(horizontal = 9.dp, vertical = 6.dp), color = Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

@Composable
private fun ScreenHeading(title: String, subtitle: String, icon: Int) {
    Surface(Modifier.fillMaxWidth().siteGlass(RoundedCornerShape(21.dp), accentGlow = true).padding(bottom = 3.dp), color = Color.Transparent, shape = RoundedCornerShape(21.dp), shadowElevation = 6.dp) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            AppIcon(icon, null, Accent, Modifier.size(23.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, color = PrimaryText, fontSize = 18.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(subtitle, color = SecondaryText, fontSize = 10.sp, lineHeight = 15.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

private enum class MatchDetailTab { EVENTS, LINEUP }

@Composable
private fun MatchDetailLoading(locale: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CircularProgressIndicator(color = Accent, strokeWidth = 2.dp)
            Text(L(locale, "جارٍ تحميل تفاصيل المباراة", "Chargement du match…"), color = SecondaryText, fontSize = 12.sp)
        }
    }
}

@Composable
private fun MatchDetailError(locale: String, onRetry: () -> Unit) {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            AppIcon(PublicIcons.Match, null, Accent, Modifier.size(30.dp))
            Text(L(locale, "تعذر تحميل تفاصيل المباراة", "Impossible de charger le match"), color = PrimaryText, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Text(L(locale, "تحقق من الاتصال ثم أعد المحاولة.", "Vérifiez votre connexion puis réessayez."), color = SecondaryText, fontSize = 11.sp)
            Button(onClick = onRetry, colors = ButtonDefaults.buttonColors(containerColor = Accent), shape = CircleShape) {
                Text(L(locale, "إعادة المحاولة", "Réessayer"), color = Color.White, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun MatchDetailsScreen(center: PublicMatchCenter, locale: String, clubLogo: String?) {
    var section by remember(center.match.id) { mutableStateOf(MatchDetailTab.EVENTS) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 26.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { MatchScoreHero(center.match, locale, clubLogo) }
        item {
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(PanelRaised).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                MatchDetailTab.values().forEach { tab ->
                    val active = section == tab
                    val label = when (tab) {
                        MatchDetailTab.EVENTS -> L(locale, "الأحداث", "Événements")
                        MatchDetailTab.LINEUP -> L(locale, "التشكيلة", "Composition")
                    }
                    Row(Modifier.weight(1f).clip(RoundedCornerShape(13.dp)).background(if (active) Accent else Color.Transparent).noRippleClickable { section = tab }.padding(horizontal = 4.dp, vertical = 11.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                        Text(label, color = if (active) Color.White else SecondaryText, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, softWrap = false)
                    }
                }
            }
        }
        item {
            when (section) {
                MatchDetailTab.EVENTS -> MatchEventsPanel(center, locale)
                MatchDetailTab.LINEUP -> MatchLineupPanel(center, locale)
            }
        }
    }
}

@Composable
private fun MatchScoreHero(match: PublicMatch, locale: String, clubLogo: String?) {
    val finished = match.status == "FINISHED"
    val live = match.status == "LIVE"
    val homeLogo = if (match.isHomeFixture) clubLogo else match.opponentLogo
    val awayLogo = if (match.isHomeFixture) match.opponentLogo else clubLogo
    Surface(Modifier.fillMaxWidth().siteGlass(RoundedCornerShape(25.dp), accentGlow = live), color = Color.Transparent, shape = RoundedCornerShape(25.dp), border = BorderStroke(1.dp, if (live) Accent.copy(alpha = .38f) else Hairline)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(match.competition, color = SecondaryText, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                MatchStatusBadge(locale, match.status, match.date)
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                MatchDetailsTeam(match.home, homeLogo, Modifier.weight(1f))
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    if (match.homeScore != null && match.awayScore != null) {
                        Text("${match.homeScore}  –  ${match.awayScore}", color = PrimaryText, fontSize = 23.sp, fontWeight = FontWeight.Black, maxLines = 1, softWrap = false)
                    } else Text("VS", color = SecondaryText, fontSize = 15.sp, fontWeight = FontWeight.Black)
                    Text(if (live || finished) statusLabel(locale, match.status, match.date) else formatClock(match.date), color = statusForeground(match.status), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                }
                MatchDetailsTeam(match.away, awayLogo, Modifier.weight(1f))
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Hairline))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                AppIcon(PublicIcons.Calendar, null, Accent, Modifier.size(15.dp))
                Text(formatDate(match.date, locale), color = SecondaryText, fontSize = 10.sp, modifier = Modifier.weight(1f))
                match.category?.let { Text(categoryLabel(locale, it), color = SecondaryText, fontSize = 9.sp, fontWeight = FontWeight.Bold) }
            }
            match.stadium?.takeIf { it.isNotBlank() }?.let { stadium -> Text(stadium, color = SecondaryText, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) }
        }
    }
}

@Composable
private fun MatchDetailsTeam(name: String, logo: String?, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Box(Modifier.size(54.dp).clip(CircleShape).background(Color.White).padding(5.dp), contentAlignment = Alignment.Center) {
            if (!logo.isNullOrBlank()) AsyncImage(model = logo, contentDescription = name, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
            else AppIcon(PublicIcons.Shield, null, Accent, Modifier.size(25.dp))
        }
        Text(name, color = PrimaryText, fontSize = 10.sp, lineHeight = 14.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

@Composable
private fun MatchEventsPanel(center: PublicMatchCenter, locale: String) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionHeading(L(locale, "أحداث المباراة", "Événements du match"), PublicIcons.Match, locale)
        if (center.events.isEmpty()) {
            EmptyState(if (center.match.status == "LIVE") L(locale, "ستظهر أحداث المباراة هنا عند تسجيلها.", "Les actions apparaîtront ici dès qu’elles seront enregistrées.") else L(locale, "لا توجد أحداث مسجلة لهذه المباراة.", "Aucun événement n’a été enregistré pour ce match."))
        } else {
            center.events.sortedBy { it.minute }.forEach { event -> MatchEventRow(event, center.match, locale) }
        }
    }
}

@Composable
private fun MatchEventRow(event: PublicMatchEvent, match: PublicMatch, locale: String) {
    val ourSide = if (match.isHomeFixture) "HOME" else "AWAY"
    val eventLabel = frenchEventLabel(event.type, locale)
    val isGoal = event.type.contains("GOAL", true)
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp)).background(Panel).padding(horizontal = 12.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
        Text("${event.minute}′", color = Accent, fontSize = 11.sp, fontWeight = FontWeight.Black, modifier = Modifier.widthIn(min = 32.dp))
        Box(Modifier.size(30.dp).clip(CircleShape).background(if (isGoal) Accent.copy(alpha = .16f) else PanelRaised), contentAlignment = Alignment.Center) {
            AppIcon(if (isGoal) PublicIcons.Trophy else PublicIcons.Match, null, if (isGoal) Accent else SecondaryText, Modifier.size(15.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(eventLabel, color = PrimaryText, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Text(event.player, color = SecondaryText, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Text(if (event.side == ourSide) L(locale, "ESH", "ESH") else L(locale, "الخصم", "Adversaire"), color = SecondaryText, fontSize = 8.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun MatchLineupPanel(center: PublicMatchCenter, locale: String) {
    var starters by remember(center.match.id) { mutableStateOf(true) }
    val players = if (starters) center.starting else center.substitutes
    Column(verticalArrangement = Arrangement.spacedBy(11.dp)) {
        SectionHeading(L(locale, "التشكيلة", "Composition"), PublicIcons.Team, locale)
        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(PanelRaised).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            listOf(true, false).forEach { isStarting ->
                val active = starters == isStarting
                val label = if (isStarting) L(locale, "الأساسيون", "Titulaires") else L(locale, "الاحتياط", "Remplaçants")
                Row(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (active) Accent else Color.Transparent).noRippleClickable { starters = isStarting }.padding(vertical = 10.dp), horizontalArrangement = Arrangement.Center) {
                    Text("$label  ·  ${if (isStarting) center.starting.size else center.substitutes.size}", color = if (active) Color.White else SecondaryText, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        if (players.isEmpty()) {
            EmptyState(if (starters) L(locale, "لم تُنشر التشكيلة الأساسية بعد.", "La composition de départ n’a pas encore été publiée.") else L(locale, "لم يُنشر الاحتياط بعد.", "Les remplaçants n’ont pas encore été publiés."))
        } else {
            val groups = listOf("GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD")
            groups.forEach { group ->
                val members = players.filter { matchPositionGroup(it.position) == group }
                if (members.isNotEmpty()) {
                    Text(matchPositionLabel(group, locale), color = SecondaryText, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 3.dp))
                    members.forEach { MatchPlayerRow(it, locale) }
                }
            }
        }
    }
}

@Composable
private fun MatchPlayerRow(player: PublicMatchPlayer, locale: String) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Panel).padding(horizontal = 11.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(34.dp).clip(CircleShape).background(PanelRaised), contentAlignment = Alignment.Center) {
            if (!player.photo.isNullOrBlank()) AsyncImage(model = player.photo, contentDescription = player.name, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            else Text(player.name.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "–", color = Accent, fontSize = 11.sp, fontWeight = FontWeight.Black)
        }
        Text(player.number?.toString() ?: "–", Modifier.clip(RoundedCornerShape(8.dp)).background(Accent.copy(alpha = .1f)).padding(horizontal = 8.dp, vertical = 6.dp), color = Accent, fontSize = 10.sp, fontWeight = FontWeight.Black)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(player.name, color = PrimaryText, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(matchPositionLabel(matchPositionGroup(player.position), locale), color = SecondaryText, fontSize = 9.sp)
        }
        if (player.captain) Text("C", Modifier.clip(CircleShape).background(Accent.copy(alpha = .15f)).padding(horizontal = 8.dp, vertical = 5.dp), color = Accent, fontSize = 9.sp, fontWeight = FontWeight.Black)
    }
}

private fun matchPositionGroup(position: String?): String {
    val value = position.orEmpty().trim().uppercase(Locale.ROOT)
    return when {
        value in setOf("GOALKEEPER", "GK", "G", "GARDIEN") || value.contains("حارس") -> "GOALKEEPER"
        value in setOf("DEFENDER", "CB", "LB", "RB", "DC", "DL", "DR") || value.contains("DEF") || value.contains("دفاع") -> "DEFENDER"
        value in setOf("MIDFIELDER", "DM", "CM", "AM", "MF", "MDF", "MC", "MO") || value.contains("MID") || value.contains("وسط") -> "MIDFIELDER"
        value in setOf("FORWARD", "ST", "CF", "LW", "RW", "FW", "AC", "AL", "AR") || value.contains("FOR") || value.contains("مهاجم") || value.contains("جناح") -> "FORWARD"
        else -> "MIDFIELDER"
    }
}

private fun matchPositionLabel(position: String, locale: String): String {
    val value = position.trim().uppercase(Locale.ROOT).substringBefore(":")
    return when (value) {
        "GOALKEEPER", "GK", "G", "GARDIEN" -> L(locale, "حارس المرمى", "Gardien")
        "DEFENDER", "CB", "LB", "RB", "DC", "DL", "DR" -> L(locale, "الدفاع", "Défenseur")
        "MIDFIELDER", "DM", "CM", "AM", "MF", "MDF", "MC", "MO" -> L(locale, "وسط الميدان", "Milieu")
        "FORWARD", "ST", "CF", "LW", "RW", "FW", "AC", "AL", "AR" -> L(locale, "الهجوم", "Attaquant")
        else -> if (locale == "fr") "Poste" else position
    }
}

@Composable
private fun ArticleLoadingScreen(locale: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CircularProgressIndicator(color = Accent, strokeWidth = 2.dp)
            Text(L(locale, "جارٍ تجهيز الخبر للقراءة", "Chargement de l’actualité…"), color = SecondaryText, fontSize = 12.sp)
        }
    }
}

@Composable
private fun ArticleErrorScreen(locale: String, onRetry: () -> Unit) {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(11.dp)) {
            Box(Modifier.size(52.dp).clip(CircleShape).background(Accent.copy(alpha = .12f)), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.News, null, Accent, Modifier.size(24.dp)) }
            Text(L(locale, "تعذر تحميل الخبر", "Impossible de charger l’actualité"), color = PrimaryText, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(L(locale, "تحقق من الاتصال ثم حاول مرة أخرى.", "Vérifiez votre connexion puis réessayez."), color = SecondaryText, fontSize = 11.sp)
            Button(onClick = onRetry, colors = ButtonDefaults.buttonColors(containerColor = Accent), shape = CircleShape) {
                Text(L(locale, "إعادة المحاولة", "Réessayer"), color = Color.White, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun ArticleReaderScreen(article: PublicArticle, locale: String) {
    val paragraphs = remember(article.content) { article.content.split(Regex("\\n\\s*\\n")).map(String::trim).filter(String::isNotEmpty) }
    val minutes = ((article.content.trim().split(Regex("\\s+")).size + 179) / 180).coerceAtLeast(1)
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 30.dp), verticalArrangement = Arrangement.spacedBy(0.dp)) {
        item {
            Box(Modifier.fillMaxWidth().height(252.dp).background(Brush.linearGradient(listOf(Accent.copy(alpha = .24f), PanelRaised, Canvas)))) {
                if (!article.image.isNullOrBlank()) {
                    AsyncImage(model = article.image, contentDescription = article.title, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                } else {
                    Box(Modifier.align(Alignment.CenterEnd).padding(end = 40.dp).size(170.dp).clip(CircleShape).background(Accent.copy(alpha = .10f)))
                    AppIcon(PublicIcons.News, null, Accent.copy(alpha = .58f), Modifier.align(Alignment.Center).size(54.dp))
                }
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Canvas.copy(alpha = .06f), Color.Transparent, Canvas.copy(alpha = .96f)))))
                Row(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(horizontal = 21.dp, vertical = 17.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    Box(Modifier.size(32.dp).clip(CircleShape).background(Panel.copy(alpha = .88f)).padding(5.dp), contentAlignment = Alignment.Center) {
                        AsyncImage(model = R.drawable.esh_logo, contentDescription = "ESH", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(L(locale, "أخبار النادي", "ACTUALITÉS DU CLUB"), color = Color.White.copy(alpha = .86f), fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                        Text(formatDate(article.date, locale), color = Color.White.copy(alpha = .72f), fontSize = 10.sp, fontWeight = FontWeight.Medium)
                    }
                }
            }
        }
        item {
            Column(Modifier.fillMaxWidth().widthIn(max = 760.dp).padding(horizontal = 22.dp).padding(top = 24.dp, bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    article.category?.takeIf { it.isNotBlank() }?.let {
                        Text(it, Modifier.clip(CircleShape).background(Accent.copy(alpha = .14f)).padding(horizontal = 11.dp, vertical = 6.dp), color = Accent, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Text(L(locale, "$minutes دقائق قراءة", "$minutes min de lecture"), color = SecondaryText, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                }
                Text(article.title, color = PrimaryText, fontSize = 27.sp, lineHeight = 37.sp, fontWeight = FontWeight.Black)
                Box(Modifier.width(48.dp).height(3.dp).clip(CircleShape).background(Accent))
            }
        }
        items(paragraphs.size) { index ->
            Text(
                paragraphs[index],
                Modifier.fillMaxWidth().widthIn(max = 760.dp).padding(horizontal = 22.dp).padding(bottom = 18.dp),
                color = PrimaryText.copy(alpha = .9f),
                fontSize = 16.sp,
                lineHeight = 29.sp
            )
        }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.weight(1f).height(1.dp).background(Hairline))
                Box(Modifier.size(34.dp).clip(CircleShape).background(PanelRaised).padding(6.dp), contentAlignment = Alignment.Center) { AsyncImage(model = R.drawable.esh_logo, contentDescription = "ESH", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit) }
                Box(Modifier.weight(1f).height(1.dp).background(Hairline))
            }
        }
    }
}

@Composable
private fun AlbumDialog(album: PublicAlbum, locale: String, onPhoto: (PublicPhoto) -> Unit, onVideo: (String) -> Unit, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxWidth().fillMaxHeight(.88f).padding(12.dp).siteGlass(RoundedCornerShape(24.dp), accentGlow = true), color = Color.Transparent, shape = RoundedCornerShape(24.dp), border = BorderStroke(1.dp, Hairline)) {
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

private fun socialReelPlayerUrl(reel: PublicReel): String? {
    val uri = runCatching { Uri.parse(reel.url) }.getOrNull() ?: return null
    val host = uri.host?.lowercase(Locale.ROOT)?.removePrefix("www.") ?: return null
    if (uri.scheme != "https") return null
    return when (reel.platform.lowercase(Locale.ROOT)) {
        "tiktok" -> {
            if (host != "tiktok.com" && host != "vm.tiktok.com") return null
            val id = Regex("/(?:video|photo)/(\\d+)").find(uri.path.orEmpty())?.groupValues?.getOrNull(1)
                ?: Regex("/player/v1/(\\d+)").find(uri.path.orEmpty())?.groupValues?.getOrNull(1)
                ?: return null
            "https://www.tiktok.com/player/v1/$id?controls=1&description=1&music_info=1&rel=0"
        }
        "instagram" -> {
            if (host != "instagram.com") return null
            val id = Regex("^/(?:reel|reels|p)/([A-Za-z0-9_-]+)").find(uri.path.orEmpty())?.groupValues?.getOrNull(1) ?: return null
            "https://www.instagram.com/reel/$id/embed/?hidecaption=true"
        }
        "facebook" -> {
            if (host != "facebook.com" && host != "fb.watch" && host != "m.facebook.com") return null
            Uri.parse("https://www.facebook.com/plugins/video.php")
                .buildUpon()
                .appendQueryParameter("href", reel.url)
                .appendQueryParameter("show_text", "false")
                .appendQueryParameter("width", "560")
                .build()
                .toString()
        }
        else -> null
    }
}

private fun isAllowedSocialEmbedHost(platform: String, rawHost: String): Boolean {
    val host = rawHost.lowercase(Locale.ROOT).removePrefix("www.")
    return when (platform.lowercase(Locale.ROOT)) {
        "tiktok" -> host == "tiktok.com" || host.endsWith(".tiktok.com") || host.endsWith(".tiktokcdn.com") || host.endsWith(".tiktokcdn-us.com") || host.endsWith(".byteoversea.com")
        "instagram" -> host == "instagram.com" || host.endsWith(".instagram.com") || host.endsWith(".cdninstagram.com") || host.endsWith(".fbcdn.net") || host.endsWith(".facebook.com")
        "facebook" -> host == "facebook.com" || host.endsWith(".facebook.com") || host == "fb.watch" || host.endsWith(".fbcdn.net")
        else -> false
    }
}

@Composable
private fun SocialReelDialog(reel: PublicReel, locale: String, onDismiss: () -> Unit, onOpenExternal: () -> Unit) {
    val playerUrl = remember(reel) { socialReelPlayerUrl(reel) }
    var webView by remember(playerUrl) { mutableStateOf<WebView?>(null) }
    var isLoading by remember(playerUrl) { mutableStateOf(playerUrl != null) }
    var loadFailed by remember(playerUrl) { mutableStateOf(false) }
    DisposableEffect(webView) {
        onDispose {
            webView?.stopLoading()
            webView?.loadUrl("about:blank")
            webView?.destroy()
        }
    }
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxWidth().fillMaxHeight(.9f).padding(horizontal = 12.dp, vertical = 8.dp).widthIn(max = 640.dp).siteGlass(RoundedCornerShape(28.dp), accentGlow = true), color = Color.Transparent, shape = RoundedCornerShape(28.dp), shadowElevation = 24.dp, border = BorderStroke(1.dp, Hairline)) {
            Column(Modifier.padding(13.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(horizontal = 3.dp, vertical = 4.dp)) {
                    Box(Modifier.size(39.dp).clip(CircleShape).background(Accent.copy(alpha = .14f)), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Play, null, Mint, Modifier.size(19.dp)) }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(L(locale, "لقطات النادي", "Les vidéos du club"), color = PrimaryText, fontSize = 14.sp, fontWeight = FontWeight.Black)
                        Text("${reel.platform.uppercase(Locale.ROOT)}  ·  ${reel.title}", color = SecondaryText, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Surface(onClick = onDismiss, modifier = Modifier.size(37.dp), shape = CircleShape, color = PanelRaised) {
                        Box(contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Close, L(locale, "إغلاق الفيديو", "Fermer la vidéo"), SecondaryText, Modifier.size(17.dp)) }
                    }
                }
                Spacer(Modifier.height(10.dp))
                if (playerUrl != null) {
                    Box(Modifier.weight(1f).fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(Color.Black)) {
                        AndroidView(
                            modifier = Modifier.fillMaxSize(),
                            factory = { viewContext ->
                                WebView(viewContext).apply {
                                    settings.javaScriptEnabled = true
                                    settings.domStorageEnabled = true
                                    settings.mediaPlaybackRequiresUserGesture = true
                                    settings.allowFileAccess = false
                                    settings.allowContentAccess = false
                                    settings.javaScriptCanOpenWindowsAutomatically = false
                                    settings.setSupportMultipleWindows(false)
                                    settings.loadsImagesAutomatically = true
                                    CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                                    webChromeClient = WebChromeClient()
                                    webViewClient = object : WebViewClient() {
                                        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                            val target = request?.url ?: return true
                                            val targetHost = target.host ?: return true
                                            return !(target.scheme == "https" && isAllowedSocialEmbedHost(reel.platform, targetHost))
                                        }

                                        override fun onPageFinished(view: WebView?, url: String?) {
                                            super.onPageFinished(view, url)
                                            isLoading = false
                                        }

                                        override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: android.webkit.WebResourceError?) {
                                            super.onReceivedError(view, request, error)
                                            if (request?.isForMainFrame == true) {
                                                isLoading = false
                                                loadFailed = true
                                            }
                                        }
                                    }
                                    webView = this
                                    loadUrl(playerUrl)
                                }
                            }
                        )
                        if (isLoading && !loadFailed) Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .42f)), contentAlignment = Alignment.Center) { CircularProgressIndicator(Modifier.size(28.dp), color = Mint, strokeWidth = 2.dp) }
                        if (loadFailed) {
                            Column(Modifier.fillMaxSize().background(Panel).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                                Box(Modifier.size(52.dp).clip(CircleShape).background(Accent.copy(alpha = .12f)), contentAlignment = Alignment.Center) { AppIcon(PublicIcons.Play, null, Mint, Modifier.size(22.dp)) }
                                Spacer(Modifier.height(12.dp))
                                Text(L(locale, "تعذر تشغيل المشغل المضمّن", "Le lecteur intégré est indisponible"), color = PrimaryText, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                Text(L(locale, "يمكنك فتح الفيديو في منصته الأصلية.", "Ouvrez la vidéo sur sa plateforme d’origine."), Modifier.padding(top = 5.dp), color = SecondaryText, fontSize = 10.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                                Spacer(Modifier.height(12.dp))
                                Button(onClick = onOpenExternal, colors = ButtonDefaults.buttonColors(containerColor = Accent), shape = CircleShape) { Text(L(locale, "فتح الفيديو", "Ouvrir la vidéo"), color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            }
                        }
                    }
                } else {
                    Box(Modifier.weight(1f).fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(PanelRaised), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(22.dp)) {
                            AppIcon(PublicIcons.Play, null, Mint, Modifier.size(30.dp))
                            Text(L(locale, "تنسيق هذا الرابط لا يدعم المشغل داخل التطبيق.", "Ce lien n’est pas compatible avec le lecteur intégré."), color = SecondaryText, fontSize = 11.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                        }
                    }
                }
                if (!loadFailed && playerUrl != null) TextButton(onClick = { onDismiss(); onOpenExternal() }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text(L(locale, "فتح في المنصة الأصلية", "Ouvrir dans l’application d’origine"), color = SecondaryText, fontWeight = FontWeight.Bold, fontSize = 10.sp) }
            }
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
        Surface(Modifier.siteGlass(RoundedCornerShape(22.dp), accentGlow = true), color = Color.Transparent, shape = RoundedCornerShape(22.dp), border = BorderStroke(1.dp, Hairline)) {
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
private fun EmptyState(text: String) { Surface(Modifier.fillMaxWidth().siteGlass(RoundedCornerShape(17.dp)), color = Color.Transparent, shape = RoundedCornerShape(17.dp), border = BorderStroke(1.dp, Hairline)) { Text(text, Modifier.padding(20.dp).fillMaxWidth(), color = SecondaryText, fontSize = 11.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center) } }

@Composable
private fun itemRetry(onRetry: () -> Unit, locale: String) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        TextButton(onClick = onRetry) { Text(L(locale, "إعادة المحاولة", "Réessayer"), color = Accent, fontWeight = FontWeight.Bold) }
    }
}

private fun PublicTab.icon(selected: Boolean) = when (this) {
    PublicTab.HOME -> if (selected) PublicIcons.HomeSelected else PublicIcons.Home
    PublicTab.TEAM -> PublicIcons.Team
    PublicTab.MATCHES -> if (selected) PublicIcons.MatchSelected else PublicIcons.Match
    PublicTab.COMPETITIONS -> PublicIcons.Trophy
    PublicTab.NEWS -> PublicIcons.News
    PublicTab.GALLERY -> PublicIcons.Media
    PublicTab.CLUB -> PublicIcons.Club
    PublicTab.ALERTS -> if (selected) PublicIcons.AlertsSelected else PublicIcons.Alerts
}
private fun PublicTab.label(locale: String) = when (this) {
    PublicTab.HOME -> L(locale, "الرئيسية", "Accueil")
    PublicTab.TEAM -> L(locale, "الفريق", "Effectifs")
    PublicTab.MATCHES -> L(locale, "المباريات", "Matchs")
    PublicTab.COMPETITIONS -> L(locale, "المسابقات", "Compétitions")
    PublicTab.NEWS -> L(locale, "الأخبار", "Actualités")
    PublicTab.GALLERY -> L(locale, "المعرض", "Galerie")
    PublicTab.CLUB -> L(locale, "النادي", "Club")
    PublicTab.ALERTS -> L(locale, "التنبيهات", "Notifications")
}
private fun L(locale: String, arabic: String, french: String) = if (locale == "ar") arabic else french
private fun categoryLabel(locale: String, category: String) = when (category.trim().uppercase(Locale.ROOT)) { "SENIOR", "SENIORS", "SÉNIORS" -> L(locale, "الأكابر", "Séniors"); "U20" -> "U20"; "U17" -> "U17"; "U15" -> "U15"; "ALL" -> L(locale, "الكل", "Toutes"); else -> if (locale == "fr") "Équipe" else category }
private fun categoryMatches(actual: String?, selected: String): Boolean {
    if (selected == "ALL") return true
    if (selected == "SENIOR") return actual.equals("SENIOR", true) || actual.equals("Séniors", true) || actual.equals("Seniors", true)
    return actual.equals(selected, true)
}
private fun albumCategory(locale: String, category: String) = when (category) { "MATCHES" -> L(locale, "مباريات", "Matchs"); "TRAINING" -> L(locale, "تدريبات", "Entraînements"); "TEAM" -> L(locale, "الفريق", "Équipe"); "EVENTS" -> L(locale, "فعاليات", "Événements"); else -> L(locale, "النادي", "Club") }
private fun statusLabel(locale: String, status: String, date: String? = null): String = when (status.trim().uppercase(Locale.ROOT)) {
    "LIVE" -> L(locale, "مباشرة", "En direct")
    "SCHEDULED", "UPCOMING" -> if (date != null && matchStartsSoon(date)) L(locale, "تبدأ قريباً", "Débute bientôt") else L(locale, "مبرمجة", "Programmée")
    "FINISHED", "COMPLETED" -> L(locale, "منتهية", "Terminée")
    "POSTPONED" -> L(locale, "مؤجلة", "Reportée")
    "CANCELLED", "CANCELED" -> L(locale, "ملغاة", "Annulée")
    else -> if (locale == "fr") "Statut à confirmer" else status
}
private fun matchStartsSoon(value: String): Boolean = runCatching {
    val kickoff = if (value.all(Char::isDigit)) {
        val raw = value.toLong()
        if (raw < 10_000_000_000L) raw * 1_000L else raw
    } else {
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
            isLenient = true
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.parse(value.take(19))?.time ?: return false
    }
    kickoff >= System.currentTimeMillis() && kickoff - System.currentTimeMillis() <= 60L * 60L * 1_000L
}.getOrDefault(false)
private fun statusForeground(status: String): Color = when (status.trim().uppercase(Locale.ROOT)) {
    "LIVE", "SCHEDULED", "UPCOMING" -> Accent
    "FINISHED", "COMPLETED", "POSTPONED", "CANCELLED", "CANCELED" -> SecondaryText
    else -> SecondaryText
}
private fun statusBackground(status: String): Color = when (status.trim().uppercase(Locale.ROOT)) {
    "LIVE" -> Accent.copy(alpha = .15f)
    "SCHEDULED", "UPCOMING" -> Accent.copy(alpha = .10f)
    else -> PanelRaised
}
private fun frenchEventLabel(type: String, locale: String) = when (type.trim().uppercase(Locale.ROOT)) {
    "GOAL" -> L(locale, "هدف", "But")
    "PENALTY_GOAL" -> L(locale, "هدف من ركلة جزاء", "But sur penalty")
    "OWN_GOAL" -> L(locale, "هدف عكسي", "But contre son camp")
    "ASSIST" -> L(locale, "تمريرة حاسمة", "Passe décisive")
    "SHOT" -> L(locale, "تسديدة", "Tir")
    "PENALTY_MISSED" -> L(locale, "ركلة جزاء ضائعة", "Penalty manqué")
    "YELLOW_CARD" -> L(locale, "بطاقة صفراء", "Carton jaune")
    "RED_CARD" -> L(locale, "بطاقة حمراء", "Carton rouge")
    "SUBSTITUTION_IN" -> L(locale, "دخول لاعب", "Entrée en jeu")
    "SUBSTITUTION_OUT" -> L(locale, "خروج لاعب", "Sortie du terrain")
    else -> if (locale == "fr") "Événement du match" else type
}
private fun mediaCountLabel(locale: String, count: Int): String = if (locale == "fr") "$count ${if (count == 1) "média" else "médias"}" else "$count وسائط"
private fun formatDate(value: String, locale: String): String = runCatching {
    val date = if (value.all(Char::isDigit)) {
        val timestamp = value.toLong()
        Date(if (timestamp < 10_000_000_000L) timestamp * 1_000L else timestamp)
    } else {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { isLenient = true }
        parser.parse(value.take(19)) ?: error("invalid date")
    }
    SimpleDateFormat(if (locale == "fr") "d MMM yyyy" else "dd/MM/yyyy", if (locale == "fr") Locale.FRANCE else Locale.forLanguageTag("ar")).format(date)
}.getOrElse { value.take(10).replace('-', '/') }
private fun formatClock(value: String): String = value.substringAfter('T', value).take(5)
private fun isVideo(url: String) = listOf(".mp4", ".webm", ".mov", ".m3u8").any { url.substringBefore('?').lowercase().endsWith(it) }
private fun openUrl(url: String, context: android.content.Context) { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } }
