package dz.esh.footballclub.field

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.res.painterResource
import androidx.compose.foundation.Image
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Campaign
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Language
import androidx.compose.material.icons.rounded.Logout
import androidx.compose.material.icons.rounded.NotificationsNone
import androidx.compose.material.icons.rounded.Article
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.FitnessCenter
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.SportsSoccer
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.Typography
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
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
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val Ink = Color(0xFF0D0E0F)
private val Panel = Color(0xFF161819)
private val Glass = Color(0xCC1D2023)
private val Red = Color(0xFFDC2626)
private val Mint = Color(0xFF20D7A0)
private val Muted = Color(0xFF98A0AA)
private val GlassBorder = Color.White.copy(alpha = .09f)
private val RedGlow = Red.copy(alpha = .20f)
private val MintGlow = Red.copy(alpha = .12f)
private val CairoFamily = FontFamily(Font(R.font.cairo_variable, FontWeight.Normal))
private fun L(locale: String, ar: String, fr: String): String = if (locale == "fr") fr else ar

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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
    }
}

private enum class Section(val icon: ImageVector) {
    HOME(Icons.Rounded.Home), MATCHES(Icons.Rounded.SportsSoccer), MEETINGS(Icons.Rounded.Groups), ALERTS(Icons.Rounded.NotificationsNone)
}
private fun Section.title(locale: String) = when (this) { Section.HOME -> L(locale, "الرئيسية", "Accueil"); Section.MATCHES -> L(locale, "المباريات", "Matchs"); Section.MEETINGS -> L(locale, "الاجتماعات", "Réunions"); Section.ALERTS -> L(locale, "الإشعارات", "Notifications") }
private fun Section.subtitle(locale: String) = when (this) { Section.HOME -> L(locale, "مساحة العمل الميداني", "Espace de gestion terrain"); Section.MATCHES -> L(locale, "إدارة المباراة لحظة بلحظة", "Gestion des matchs en direct"); Section.MEETINGS -> L(locale, "مواعيد وقرارات النادي", "Calendrier et décisions du club"); Section.ALERTS -> L(locale, "إشعارات الإدارة على الهاتف", "Alertes administratives sur le téléphone") }

@Composable
private fun MatchdayApp() {
    val context = LocalContext.current
    val sessionStore = remember { NativeSessionStore(context) }
    val scope = rememberCoroutineScope()
    var token by remember { mutableStateOf(sessionStore.read()) }
    var user by remember { mutableStateOf<NativeUser?>(null) }
    var data by remember { mutableStateOf<NativeData?>(null) }
    var loading by remember { mutableStateOf(false) }
    var connectionError by remember { mutableStateOf<String?>(null) }
    var section by remember { mutableStateOf(Section.HOME) }
    val preferences = remember { context.getSharedPreferences("esh_native_ui", android.content.Context.MODE_PRIVATE) }
    var locale by remember { mutableStateOf(preferences.getString("locale", "ar") ?: "ar") }
    var composerType by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(token, locale) {
        val activeToken = token ?: return@LaunchedEffect
        loading = true
        connectionError = null
        val result = runCatching {
            withContext(Dispatchers.IO) {
                val profile = NativeApi.session(activeToken)
                val payload = NativeApi.data(activeToken, locale)
                profile to payload
            }
        }
        result.onSuccess { (profile, payload) -> user = profile; data = payload }
            .onFailure { sessionStore.clear(); token = null; user = null; data = null; connectionError = L(locale, "انتهت الجلسة أو تعذر الاتصال. سجّل الدخول مجددًا.", "Session expirée ou serveur inaccessible. Reconnectez-vous.") }
        loading = false
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
            result.onSuccess { data = it; connectionError = null }
                .onFailure { connectionError = L(locale, "تعذر حفظ التغيير. تحقق من الاتصال والصلاحيات.", "Impossible d’enregistrer. Vérifiez la connexion et les autorisations.") }
            loading = false
        }
    }

    fun addGoal(match: NativeMatch, isClubGoal: Boolean, playerId: String?, opponentName: String?, minute: Int) {
        val activeToken = token ?: return
        scope.launch {
            loading = true
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    val clubSide = if (match.isHomeFixture) "HOME" else "AWAY"
                    val side = if (isClubGoal) clubSide else if (clubSide == "HOME") "AWAY" else "HOME"
                    NativeApi.addGoal(activeToken, match.id, side, minute, if (isClubGoal) playerId else null, opponentName)
                    NativeApi.data(activeToken, locale)
                }
            }
            result.onSuccess { data = it; connectionError = null }
                .onFailure { connectionError = L(locale, "تعذر تسجيل الهدف. تأكد من حالة المباراة واختيار اللاعب.", "But non enregistré. Vérifiez le statut du match et le joueur sélectionné.") }
            loading = false
        }
    }

    CompositionLocalProvider(LocalLayoutDirection provides if (locale == "fr") LayoutDirection.Ltr else LayoutDirection.Rtl) {
    Box(Modifier.fillMaxSize().background(Ink)) {
        AmbientGlow(Modifier.align(Alignment.TopEnd).offset(x = 125.dp, y = 45.dp).size(330.dp), RedGlow)
        AmbientGlow(Modifier.align(Alignment.BottomStart).offset(x = (-145).dp, y = (-30).dp).size(350.dp), MintGlow)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Ink.copy(alpha = .35f)))))
        if (token == null) {
            NativeLoginScreen(connectionError = connectionError, loading = loading, locale = locale, onToggleLocale = {
                locale = if (locale == "ar") "fr" else "ar"
                preferences.edit().putString("locale", locale).apply()
            }) { email, password ->
                scope.launch {
                    loading = true
                    connectionError = null
                    val login = withContext(Dispatchers.IO) { NativeApi.login(email, password, locale) }
                    if (login.token != null && login.user != null) {
                        sessionStore.write(login.token)
                        user = login.user
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
            Column(Modifier.fillMaxSize()) {
                TopHeader(user?.role ?: L(locale, "حساب إداري", "Compte administrateur"), locale = locale, onToggleLocale = {
                    locale = if (locale == "ar") "fr" else "ar"
                    preferences.edit().putString("locale", locale).apply()
                    token?.let { NativeMessagingService.updateLocale(context, it, locale) }
                }, onNotifications = { section = Section.ALERTS }, onLogout = {
                    val activeToken = token
                    sessionStore.clear(); token = null; data = null
                    if (activeToken != null) scope.launch(Dispatchers.IO) {
                        runCatching {
                            val pushToken = context.getSharedPreferences(NativeMessagingService.PUSH_PREFS, android.content.Context.MODE_PRIVATE).getString(NativeMessagingService.PUSH_TOKEN_KEY, null)
                            if (pushToken != null) NativeApi.unregisterPush(activeToken, pushToken)
                            NativeApi.logout(activeToken)
                        }
                    }
                })
                AnimatedContent(
                    targetState = section,
                    modifier = Modifier.weight(1f),
                    transitionSpec = { fadeIn() togetherWith fadeOut() },
                    label = "section-content"
                ) { selected -> SectionPage(selected, data, loading, connectionError, locale, onNavigate = { section = it }, onCreate = { composerType = it }, onUpdateMatch = ::updateMatch, onAddGoal = ::addGoal) }
                GlassNavigation(selected = section, locale = locale, onSelect = { section = it })
            }
        }
        composerType?.let { type ->
            NativeCreateDialog(type, data?.teams.orEmpty(), data?.permissions?.teamScopeRestricted == true, locale, onDismiss = { composerType = null }) { payload ->
                val activeToken = token ?: return@NativeCreateDialog
                composerType = null
                scope.launch {
                    loading = true
                    val result = runCatching { withContext(Dispatchers.IO) { NativeApi.createContent(activeToken, payload); NativeApi.data(activeToken, locale) } }
                    result.onSuccess { data = it; connectionError = L(locale, "تم الحفظ ومزامنة المنصة والموقع.", "Enregistré et synchronisé avec la plateforme et le site.") }.onFailure { connectionError = L(locale, "تعذر الحفظ. تحقق من الصلاحيات والاتصال.", "Enregistrement impossible. Vérifiez vos droits et la connexion.") }
                    loading = false
                }
            }
        }
    }
    }
}

@Composable
private fun AmbientGlow(modifier: Modifier, color: Color) {
    Box(modifier.clip(CircleShape).background(Brush.radialGradient(listOf(color, color.copy(alpha = .08f), Color.Transparent))))
}

@Composable
private fun TopHeader(role: String, locale: String, onToggleLocale: () -> Unit, onNotifications: () -> Unit, onLogout: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(start = 22.dp, end = 22.dp, top = 22.dp, bottom = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(42.dp).clip(RoundedCornerShape(14.dp)).background(Color.White.copy(alpha = .06f)), contentAlignment = Alignment.Center) {
                Image(painterResource(R.drawable.esh_logo), contentDescription = "شعار النادي", modifier = Modifier.size(35.dp))
            }
            Spacer(Modifier.width(11.dp))
            Column {
                Text("E SIDI HOSNI", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                Text(L(locale, "إدارة ميدانية", "GESTION TERRAIN") + " · $role", color = Muted, fontSize = 9.sp, letterSpacing = 1.1.sp, maxLines = 1)
            }
        }
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(if (locale == "ar") "FR" else "عربي", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(CircleShape).background(Glass).border(1.dp, Color.White.copy(alpha = .1f), CircleShape).clickable(onClick = onToggleLocale).padding(horizontal = 13.dp, vertical = 10.dp))
                Box(Modifier.size(40.dp).clip(CircleShape).background(Glass).border(1.dp, Color.White.copy(alpha = .10f), CircleShape).clickable(onClick = onNotifications), contentAlignment = Alignment.Center) {
                    Icon(Icons.Rounded.NotificationsNone, contentDescription = L(locale, "الإشعارات", "Notifications"), tint = Color.White, modifier = Modifier.size(21.dp))
                    Box(Modifier.align(Alignment.TopEnd).padding(top = 8.dp, end = 8.dp).size(7.dp).background(Red, CircleShape))
                }
                Icon(Icons.Rounded.Logout, contentDescription = L(locale, "تسجيل الخروج", "Déconnexion"), tint = Muted, modifier = Modifier.size(19.dp).clickable(onClick = onLogout))
            }
        }
    }
@Composable
private fun SectionPage(
    section: Section,
    data: NativeData?,
    loading: Boolean,
    connectionError: String?,
    locale: String,
    onNavigate: (Section) -> Unit,
    onCreate: (String) -> Unit,
    onUpdateMatch: (NativeMatch, Int, Int, String?) -> Unit,
    onAddGoal: (NativeMatch, Boolean, String?, String?, Int) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(15.dp)
    ) {
        item {
            Column(Modifier.padding(bottom = 4.dp)) {
                Text(section.title(locale), color = Color.White, fontSize = 25.sp, fontWeight = FontWeight.ExtraBold)
                Spacer(Modifier.height(5.dp))
                Text(section.subtitle(locale), color = Muted, fontSize = 12.sp)
            }
        }
        when (section) {
            Section.HOME -> {
                item { WelcomeCard(data, locale) }
                item { QuickActions(onNavigate, data, locale, onCreate) }
                item { StatusCard(loading, connectionError, locale) }
            }
            Section.MATCHES -> {
                if (data?.matches.isNullOrEmpty()) item { EmptyNativeSection(Icons.Rounded.SportsSoccer, L(locale, "إدارة المباريات", "Gestion des matchs"), L(locale, "لا توجد مباريات متاحة لحسابك حاليًا.", "Aucun match n’est disponible pour ce compte."), if (loading) L(locale, "جارٍ التحديث", "Actualisation…") else L(locale, "محدّث من المنصة", "Synchronisé avec la plateforme"), locale) }
                else items(data!!.matches) { match -> MatchCard(match, loading, locale, onUpdateMatch, onAddGoal) }
            }
            Section.MEETINGS -> {
                val meetings = data?.upcomingMeetings.orEmpty() + data?.meetings.orEmpty()
                if (meetings.isEmpty()) item { EmptyNativeSection(Icons.Rounded.CalendarMonth, L(locale, "الاجتماعات", "Réunions"), L(locale, "لا توجد اجتماعات متاحة لحسابك حاليًا.", "Aucune réunion n’est disponible pour ce compte."), if (loading) L(locale, "جارٍ التحديث", "Actualisation…") else L(locale, "محدّث من المنصة", "Synchronisé avec la plateforme"), locale) }
                else items(meetings) { meeting -> MeetingCard(meeting, locale) }
            }
            Section.ALERTS -> {
                if (data?.alerts.isNullOrEmpty()) item { EmptyNativeSection(Icons.Rounded.Campaign, L(locale, "تنبيهات الهاتف", "Alertes téléphone"), L(locale, "لا توجد تنبيهات جديدة في حسابك.", "Aucune nouvelle notification."), if (loading) L(locale, "جارٍ التحديث", "Actualisation…") else L(locale, "محدّث من المنصة", "Synchronisé avec la plateforme"), locale) }
                else items(data!!.alerts) { alert -> AlertCard(alert, locale) }
            }
        }
    }
}

@Composable
private fun WelcomeCard(data: NativeData?, locale: String) {
    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Brush.linearGradient(listOf(Color(0xEE35131E), Color(0xDC1A1B1D), Color(0xD6161819)))).border(1.dp, Color.White.copy(alpha = .12f), RoundedCornerShape(24.dp))) {
      AmbientGlow(Modifier.align(Alignment.TopEnd).offset(x = 70.dp, y = (-75).dp).size(210.dp), RedGlow)
      Column(Modifier.padding(22.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.size(8.dp).background(Red, CircleShape))
            Text(L(locale, "مساحة الإدارة الميدانية", "Espace d’administration terrain"), color = Red, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(18.dp))
        Text(L(locale, "كل تفاصيل يوم المباراة،\nفي مكان واحد.", "Toute l’organisation du match,\nen un seul endroit."), color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 33.sp)
        Spacer(Modifier.height(8.dp))
        Text(L(locale, "متابعة المباريات والاجتماعات بتنبيهات مباشرة على هاتفك.", "Suivez matchs et réunions avec des alertes directes sur votre téléphone."), color = Color(0xFFBEC8D2), fontSize = 12.sp, lineHeight = 20.sp)
        Spacer(Modifier.height(20.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            MetricChip(L(locale, "مباريات", "Matchs"), data?.matches?.size?.toString() ?: "…", Icons.Rounded.SportsSoccer)
            MetricChip(L(locale, "اجتماعات", "Réunions"), data?.let { it.meetings.size + it.upcomingMeetings.size }?.toString() ?: "…", Icons.Rounded.CalendarMonth)
        }
      }
    }
}

@Composable
private fun MetricChip(label: String, value: String, icon: ImageVector) {
    Row(Modifier.clip(RoundedCornerShape(15.dp)).background(Color.Black.copy(alpha = .22f)).border(1.dp, Color.White.copy(alpha = .08f), RoundedCornerShape(15.dp)).padding(horizontal = 13.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = Color.White.copy(alpha = .75f), modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(8.dp))
        Text(label, color = Color.White.copy(alpha = .78f), fontSize = 10.sp)
        Spacer(Modifier.width(10.dp))
        Text(value, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun QuickActions(onNavigate: (Section) -> Unit, data: NativeData?, locale: String, onCreate: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(11.dp)) {
        Text(L(locale, "وصول سريع", "Accès rapide"), color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            ActionTile(L(locale, "إدارة مباراة", "Gérer un match"), L(locale, "النتيجة والأحداث", "Score et événements"), Icons.Rounded.SportsSoccer, Red, Modifier.weight(1f).clickable { onNavigate(Section.MATCHES) })
            ActionTile(L(locale, "الاجتماعات", "Réunions"), L(locale, "المواعيد والتنبيهات", "Dates et rappels"), Icons.Rounded.CalendarMonth, Red, Modifier.weight(1f).clickable { onNavigate(Section.MEETINGS) })
        }
        if (data?.permissions?.training == true || data?.permissions?.announcements == true) {
            Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                if (data.permissions.training) ActionTile(L(locale, "إضافة تدريب", "Ajouter un entraînement"), L(locale, "إلى جدول النادي", "Au calendrier du club"), Icons.Rounded.FitnessCenter, Red, Modifier.weight(1f).clickable { onCreate("training") })
                if (data.permissions.announcements) ActionTile(L(locale, "إضافة إعلان", "Publier une annonce"), L(locale, "على الموقع العام", "Sur le site public"), Icons.Rounded.Campaign, Red, Modifier.weight(1f).clickable { onCreate("announcement") })
            }
        }
        if (data?.permissions?.news == true) {
            ActionTile(L(locale, "إضافة خبر", "Publier une actualité"), L(locale, "باللغتين على الموقع العام", "En arabe et en français sur le site"), Icons.Rounded.Article, Red, Modifier.fillMaxWidth().clickable { onCreate("news") })
        }
    }
}

@Composable
private fun ActionTile(title: String, detail: String, icon: ImageVector, accent: Color, modifier: Modifier = Modifier) {
    Column(modifier.clip(RoundedCornerShape(20.dp)).background(Brush.linearGradient(listOf(Color(0xDD20242D), Color(0xB314191F)))).border(1.dp, GlassBorder, RoundedCornerShape(20.dp)).padding(15.dp)) {
        Box(Modifier.size(35.dp).clip(RoundedCornerShape(12.dp)).background(accent.copy(alpha = .15f)), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(19.dp))
        }
        Spacer(Modifier.height(13.dp))
        Text(title, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(4.dp))
        Text(detail, color = Muted, fontSize = 10.sp)
    }
}

@Composable
private fun StatusCard(loading: Boolean, error: String?, locale: String) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Brush.linearGradient(listOf(Color(0xCC20252D), Color(0xA814191F)))).border(1.dp, GlassBorder, RoundedCornerShape(18.dp)).padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(36.dp).clip(CircleShape).background(Red.copy(alpha = .12f)), contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.Tune, contentDescription = null, tint = Red, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(L(locale, "حالة الاتصال", "État de connexion"), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Text(error ?: if (loading) L(locale, "جارٍ مزامنة حساب المنصة", "Synchronisation de la plateforme…") else L(locale, "متصل بحساب المنصة", "Connecté à la plateforme"), color = Muted, fontSize = 10.sp)
        }
        Box(Modifier.size(8.dp).background(Color(0xFFF1A84B), CircleShape))
    }
}

@Composable
private fun MatchCard(
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

    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(Brush.linearGradient(listOf(Color(0xD921252D), Color(0xB313181E)))).border(1.dp, GlassBorder, RoundedCornerShape(22.dp)).clickable { expanded = !expanded }.padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(match.opponent, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
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
            Text(match.events.takeLast(3).joinToString("   ·   ") { "${it.minute}′ ${it.playerName ?: eventLabel(it.type, locale)}" }, color = Color(0xFFB8C5CE), fontSize = 10.sp, maxLines = 2)
        }

        if (expanded) {
            Spacer(Modifier.height(14.dp))
            Box(Modifier.fillMaxWidth().height(1.dp).background(Color.White.copy(alpha = .08f)))
            if (match.canUpdate) {
                Spacer(Modifier.height(13.dp))
                Text(L(locale, "تحديث النتيجة", "Modifier le score"), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
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
                Text(L(locale, "تسجيل هدف", "Ajouter un but"), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(value = minute, onValueChange = { minute = it.filter(Char::isDigit).take(3) }, modifier = Modifier.width(84.dp), singleLine = true, label = { Text(L(locale, "الدقيقة", "Minute")) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                    if (match.players.isNotEmpty()) {
                        Box {
                            Text(selectedPlayerName, color = Color.White, fontSize = 10.sp, maxLines = 1, modifier = Modifier.clip(RoundedCornerShape(10.dp)).background(Color.White.copy(alpha = .06f)).clickable { playerMenu = true }.padding(horizontal = 10.dp, vertical = 12.dp))
                            DropdownMenu(expanded = playerMenu, onDismissRequest = { playerMenu = false }) {
                                match.players.forEach { player -> DropdownMenuItem(text = { Text(player.number?.let { "$it · ${player.name}" } ?: player.name) }, onClick = { selectedPlayer = player.id; playerMenu = false }) }
                            }
                        }
                    }
                }
                OutlinedTextField(value = opponentName, onValueChange = { opponentName = it.take(120) }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text(L(locale, "اسم لاعب الخصم", "Nom du joueur adverse")) }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(L(locale, "هدف للنادي", "But pour le club"), color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f).clip(RoundedCornerShape(11.dp)).background(Red.copy(alpha = .75f)).clickable(enabled = !saving && selectedPlayer != null) { onAddGoal(match, true, selectedPlayer, null, minute.toIntOrNull() ?: 0) }.padding(horizontal = 8.dp, vertical = 11.dp), textAlign = TextAlign.Center)
                    Text(L(locale, "هدف للخصم", "But adverse"), color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f).clip(RoundedCornerShape(11.dp)).background(Color.White.copy(alpha = .09f)).clickable(enabled = !saving && opponentName.isNotBlank()) { onAddGoal(match, false, null, opponentName.trim(), minute.toIntOrNull() ?: 0); opponentName = "" }.padding(horizontal = 8.dp, vertical = 11.dp), textAlign = TextAlign.Center)
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
            Text("−", color = Color.White, fontSize = 19.sp, modifier = Modifier.clip(CircleShape).clickable { onChange(score - 1) }.padding(horizontal = 11.dp, vertical = 3.dp))
            Text(score.toString(), color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 5.dp))
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
    "YELLOW_CARD" -> L(locale, "إنذار", "Carton jaune")
    "RED_CARD" -> L(locale, "طرد", "Carton rouge")
    else -> type
}

private fun categoryLabel(category: String, locale: String): String = when (category) {
    "SENIOR" -> L(locale, "الأكابر", "Seniors")
    "U20" -> L(locale, "أقل من 20", "U20")
    "U17" -> L(locale, "أقل من 17", "U17")
    "U15" -> L(locale, "أقل من 15", "U15")
    else -> category
}

@Composable
private fun MeetingCard(meeting: NativeMeeting, locale: String) {
    GlassCard {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.CalendarMonth, contentDescription = null, tint = Red, modifier = Modifier.size(23.dp))
            Spacer(Modifier.width(13.dp))
            Column {
                Text(meeting.title, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(5.dp))
                Text(meeting.date.take(16).replace('T', ' '), color = Muted, fontSize = 10.sp)
                meeting.location?.takeIf { it.isNotBlank() }?.let { Text(it, color = Muted, fontSize = 10.sp) }
            }
        }
    }
}

@Composable
private fun AlertCard(alert: NativeAlert, locale: String) {
    GlassCard {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.NotificationsNone, contentDescription = null, tint = if (alert.read) Muted else Red, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(12.dp))
            Column {
                Text(alert.title, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                alert.message?.let { Text(it, color = Muted, fontSize = 10.sp) }
            }
        }
    }
}

@Composable
private fun GlassCard(content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(21.dp)).background(Brush.linearGradient(listOf(Color(0xD920252D), Color(0xB313181E)))).border(1.dp, GlassBorder, RoundedCornerShape(21.dp)).padding(16.dp)) { content() }
}

@Composable
private fun NativeCreateDialog(type: String, teams: List<NativeTeam>, teamScopeRestricted: Boolean, locale: String, onDismiss: () -> Unit, onSubmit: (org.json.JSONObject) -> Unit) {
    var titleAr by remember(type) { mutableStateOf("") }
    var contentAr by remember(type) { mutableStateOf("") }
    var titleFr by remember(type) { mutableStateOf("") }
    var contentFr by remember(type) { mutableStateOf("") }
    var date by remember(type) { mutableStateOf(java.time.LocalDate.now().toString()) }
    var startTime by remember(type) { mutableStateOf("18:00") }
    var endTime by remember(type) { mutableStateOf("19:00") }
    var location by remember(type) { mutableStateOf("") }
    var category by remember(type) { mutableStateOf("") }
    var notes by remember(type) { mutableStateOf("") }
    var teamId by remember(type, teams) { mutableStateOf(teams.firstOrNull()?.id.orEmpty()) }
    var teamMenu by remember { mutableStateOf(false) }
    val title = when (type) {
        "training" -> L(locale, "إضافة تدريب", "Nouvel entraînement")
        "announcement" -> L(locale, "إضافة إعلان", "Nouvelle annonce")
        else -> L(locale, "إضافة خبر", "Nouvelle actualité")
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(22.dp),
        containerColor = Panel,
        titleContentColor = Color.White,
        textContentColor = Muted,
        title = { Text(title, fontWeight = FontWeight.Bold, fontFamily = CairoFamily) },
        text = {
            Column(Modifier.heightIn(max = 490.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (type == "training") {
                    if (teams.isEmpty()) Text(L(locale, "لا توجد فئات متاحة لحسابك.", "Aucune équipe n’est accessible à ce compte."), color = Color(0xFFFF8792), fontSize = 12.sp)
                    else Box {
                        OutlinedTextField(value = teams.firstOrNull { it.id == teamId }?.let { "${it.name} · ${categoryLabel(it.category, locale)}" }.orEmpty(), onValueChange = {}, readOnly = true, modifier = Modifier.fillMaxWidth().clickable { teamMenu = true }, label = { Text(L(locale, "الفريق / الفئة", "Équipe / catégorie")) }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                        DropdownMenu(expanded = teamMenu, onDismissRequest = { teamMenu = false }) { teams.forEach { team -> DropdownMenuItem(text = { Text("${team.name} · ${categoryLabel(team.category, locale)}") }, onClick = { teamId = team.id; teamMenu = false }) } }
                    }
                    OutlinedTextField(value = date, onValueChange = { date = it.take(10) }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text(L(locale, "التاريخ (YYYY-MM-DD)", "Date (AAAA-MM-JJ)")) }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = startTime, onValueChange = { startTime = it.take(5) }, modifier = Modifier.weight(1f), singleLine = true, label = { Text(L(locale, "من", "Début")) }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                        OutlinedTextField(value = endTime, onValueChange = { endTime = it.take(5) }, modifier = Modifier.weight(1f), singleLine = true, label = { Text(L(locale, "إلى", "Fin")) }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                    }
                    OutlinedTextField(value = location, onValueChange = { location = it.take(160) }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text(L(locale, "المكان", "Lieu")) }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                    OutlinedTextField(value = notes, onValueChange = { notes = it.take(2000) }, modifier = Modifier.fillMaxWidth(), label = { Text(L(locale, "ملاحظات التدريب", "Notes d’entraînement")) }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                } else {
                    Text(L(locale, "سيظهر المحتوى فور حفظه في المنصة والموقع العام.", "Le contenu sera publié sur la plateforme et le site public."), color = Red, fontSize = 11.sp)
                    if (type == "announcement" && teamScopeRestricted && teams.isNotEmpty()) Box {
                        OutlinedTextField(value = teams.firstOrNull { it.id == teamId }?.let { "${it.name} · ${categoryLabel(it.category, locale)}" }.orEmpty(), onValueChange = {}, readOnly = true, modifier = Modifier.fillMaxWidth().clickable { teamMenu = true }, label = { Text(L(locale, "الفريق / الفئة", "Équipe / catégorie")) }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                        DropdownMenu(expanded = teamMenu, onDismissRequest = { teamMenu = false }) { teams.forEach { team -> DropdownMenuItem(text = { Text("${team.name} · ${categoryLabel(team.category, locale)}") }, onClick = { teamId = team.id; teamMenu = false }) } }
                    }
                    OutlinedTextField(value = titleAr, onValueChange = { titleAr = it.take(200) }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text("العنوان · العربية") }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                    OutlinedTextField(value = contentAr, onValueChange = { contentAr = it.take(20000) }, modifier = Modifier.fillMaxWidth().height(100.dp), label = { Text("النص · العربية") }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                    OutlinedTextField(value = titleFr, onValueChange = { titleFr = it.take(200) }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text("Titre · Français") }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                    OutlinedTextField(value = contentFr, onValueChange = { contentFr = it.take(20000) }, modifier = Modifier.fillMaxWidth().height(100.dp), label = { Text("Texte · Français") }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                    if (type == "news") OutlinedTextField(value = category, onValueChange = { category = it.take(80) }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text(L(locale, "التصنيف (اختياري)", "Catégorie (facultatif)")) }, shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                val payload = org.json.JSONObject().put("type", type)
                if (type == "training") payload.put("teamId", teamId).put("date", date).put("startTime", startTime).put("endTime", endTime).put("location", location).put("notes", notes)
                else {
                    payload.put("titleAr", titleAr.trim()).put("contentAr", contentAr.trim()).put("titleFr", titleFr.trim()).put("contentFr", contentFr.trim())
                    if (type == "announcement") payload.put("priority", "NORMAL").put("teamId", if (teamScopeRestricted) teamId else "") else payload.put("category", category.trim())
                }
                onSubmit(payload)
            }, enabled = if (type == "training") teamId.isNotBlank() && date.length == 10 && startTime.length == 5 && endTime.length == 5 else titleAr.isNotBlank() && contentAr.isNotBlank() && titleFr.isNotBlank() && contentFr.isNotBlank() && !(type == "announcement" && teamScopeRestricted && teamId.isBlank()), colors = ButtonDefaults.buttonColors(containerColor = Red), shape = RoundedCornerShape(12.dp)) { Text(if (type == "training") L(locale, "حفظ التدريب", "Enregistrer la séance") else L(locale, "حفظ ونشر", "Enregistrer et publier"), color = Color.White, fontFamily = CairoFamily) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(L(locale, "إلغاء", "Annuler"), color = Muted, fontFamily = CairoFamily) } }
    )
}

@Composable
private fun NativeLoginScreen(connectionError: String?, loading: Boolean, locale: String, onToggleLocale: () -> Unit, onLogin: (String, String) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val emailFocus = remember { FocusRequester() }
    val passwordFocus = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    Box(Modifier.fillMaxSize()) {
      AmbientGlow(Modifier.align(Alignment.TopEnd).offset(x = 155.dp, y = (-10).dp).size(370.dp), RedGlow)
      AmbientGlow(Modifier.align(Alignment.BottomStart).offset(x = (-185).dp, y = 22.dp).size(400.dp), MintGlow)
      Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 22.dp, vertical = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Text(if (locale == "ar") "FR" else "عربي", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(CircleShape).background(Color(0xAA20252D)).border(1.dp, GlassBorder, CircleShape).clickable(onClick = onToggleLocale).padding(horizontal = 15.dp, vertical = 9.dp))
        }
        Spacer(Modifier.height(16.dp))
        Box(Modifier.size(82.dp).clip(RoundedCornerShape(27.dp)).background(Brush.linearGradient(listOf(Color(0xCC29252C), Color(0xAA11171D)))).border(1.dp, Color.White.copy(alpha = .17f), RoundedCornerShape(27.dp)), contentAlignment = Alignment.Center) {
            Image(painterResource(R.drawable.esh_logo), contentDescription = null, modifier = Modifier.size(62.dp))
        }
        Spacer(Modifier.height(15.dp))
        Text("E SIDI HOSNI", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
        Text(L(locale, "بوابة الإدارة الميدانية", "Espace d’administration terrain"), color = Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
        Spacer(Modifier.height(22.dp))
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Brush.linearGradient(listOf(Color(0xF01A1B1D), Color(0xE6111214)))).border(1.dp, Color.White.copy(alpha = .12f), RoundedCornerShape(24.dp)).padding(21.dp)) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(4.dp, 32.dp).clip(CircleShape).background(Brush.verticalGradient(listOf(Red, Red.copy(alpha = .50f)))))
            Spacer(Modifier.width(12.dp))
            Column {
              Text(L(locale, "أهلًا بعودتك", "Bon retour"), color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.ExtraBold)
              Text(L(locale, "سجّل الدخول بحساب إداري للمتابعة", "Connectez-vous avec votre compte administrateur."), color = Muted, fontSize = 11.sp)
            }
          }
          Spacer(Modifier.height(22.dp))
          CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
              OutlinedTextField(value = email, onValueChange = { email = it }, modifier = Modifier.fillMaxWidth().focusRequester(emailFocus), enabled = !loading, singleLine = true, label = { Text(L(locale, "البريد الإلكتروني", "Adresse e-mail")) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next, capitalization = KeyboardCapitalization.None, autoCorrectEnabled = false), keyboardActions = KeyboardActions(onNext = { passwordFocus.requestFocus() }), shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
          }
          Spacer(Modifier.height(12.dp))
          CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
              OutlinedTextField(value = password, onValueChange = { password = it }, modifier = Modifier.fillMaxWidth().focusRequester(passwordFocus), enabled = !loading, singleLine = true, label = { Text(L(locale, "كلمة المرور", "Mot de passe")) }, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done), keyboardActions = KeyboardActions(onDone = { keyboard?.hide(); if (email.isNotBlank() && password.isNotBlank()) onLogin(email.trim(), password) }), shape = RoundedCornerShape(12.dp), colors = loginFieldColors())
          }
          connectionError?.let { Text(it, color = Color(0xFFFF8792), fontSize = 11.sp, modifier = Modifier.padding(top = 9.dp)) }
          Spacer(Modifier.height(17.dp))
          Button(onClick = { keyboard?.hide(); onLogin(email.trim(), password) }, enabled = !loading && email.isNotBlank() && password.isNotBlank(), modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = Red, disabledContainerColor = Color(0xFF551522), contentColor = Color.White, disabledContentColor = Color.White.copy(alpha = .76f))) {
              if (loading) CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(19.dp)) else Text(L(locale, "تسجيل الدخول", "Se connecter"), color = Color.White, fontWeight = FontWeight.Bold)
          }
          Text(L(locale, "التحقق الأمني يعمل داخل التطبيق", "La vérification de sécurité est intégrée à l’application."), color = Muted, fontSize = 10.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 14.dp))
        }
        Spacer(Modifier.height(20.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
          Box(Modifier.size(6.dp).background(Red, CircleShape)); Spacer(Modifier.width(7.dp))
          Text(L(locale, "إدارة المباريات والاجتماعات بأمان", "Gérez matchs et réunions en toute sécurité"), color = Muted, fontSize = 10.sp)
        }
      }
    }
}

@Composable
private fun loginFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    focusedContainerColor = Color(0xFF181A1C),
    unfocusedContainerColor = Color(0xFF121416),
    focusedBorderColor = Red,
    unfocusedBorderColor = Color.White.copy(alpha = .12f),
    focusedLabelColor = Red,
    unfocusedLabelColor = Muted,
    cursorColor = Red
)

@Composable
private fun EmptyNativeSection(icon: ImageVector, title: String, body: String, badge: String, locale: String) {
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
private fun GlassNavigation(selected: Section, locale: String, onSelect: (Section) -> Unit) {
    Row(
        Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.navigationBars).padding(start = 18.dp, end = 18.dp, bottom = 10.dp, top = 9.dp).height(66.dp).clip(CircleShape).background(Brush.horizontalGradient(listOf(Color(0xE620252D), Color(0xE612171D)))).border(1.dp, Color.White.copy(alpha = .15f), CircleShape).padding(horizontal = 7.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        (if (locale == "ar") Section.entries.reversed() else Section.entries).forEach { item ->
            val active = selected == item
            val activeColor by animateColorAsState(if (active) Color(0xFF3B1420) else Color.Transparent, label = "nav-bg")
            val width by animateDpAsState(if (active) 76.dp else 54.dp, label = "nav-width")
            Column(
                Modifier.width(width).fillMaxSize().clip(CircleShape).background(activeColor).clickable { onSelect(item) }.padding(horizontal = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(item.icon, contentDescription = item.title(locale), tint = if (active) Red else Muted, modifier = Modifier.size(21.dp))
                if (active) {
                    Spacer(Modifier.height(2.dp))
                    Text(item.title(locale), color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                }
            }
        }
    }
}
