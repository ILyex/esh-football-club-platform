package dz.esh.footballclub.field

import android.content.Context
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

data class NativeMatch(
    val id: String,
    val opponent: String,
    val date: String,
    val status: String,
    val clubScore: Int?,
    val opponentScore: Int?,
    val competition: String,
    val isHomeFixture: Boolean,
    val canUpdate: Boolean,
    val canReport: Boolean,
    val players: List<NativePlayer>,
    val events: List<NativeEvent>,
    val shotsFor: Int,
    val shotsAgainst: Int,
    val xgFor: Double,
    val xgAgainst: Double,
    val yellowCardsFor: Int,
    val redCardsFor: Int
)

data class NativePlayer(val id: String, val name: String, val nameFr: String, val number: Int?)
data class NativeEvent(val id: String, val type: String, val minute: Int, val side: String, val playerName: String?, val xG: Double?, val source: String)
data class NativeMeeting(val id: String, val title: String, val date: String, val location: String?, val status: String)
data class NativeCalendarItem(val id: String, val type: String, val title: String, val startDateTime: String, val endDateTime: String, val location: String?, val team: String?, val isHomeFixture: Boolean? = null, val opponentLogo: String? = null)
data class NativeAlert(val id: String, val title: String, val message: String?, val read: Boolean, val kind: String = "MATCH")
data class NativeStanding(val id: String, val rank: Int, val teamName: String, val teamLogo: String?, val isOurClub: Boolean, val played: Int, val won: Int, val drawn: Int, val lost: Int, val goalsFor: Int, val goalsAgainst: Int, val goalDifference: Int, val points: Int, val form: List<String>)
data class NativeCompetition(val id: String, val name: String, val type: String, val logoUrl: String?, val organization: String?, val seasonLabel: String, val category: String, val categoryLabel: String, val standings: List<NativeStanding>, val canManage: Boolean)
data class NativeTeam(val id: String, val name: String, val category: String)
data class NativeCoach(val id: String, val name: String, val teamIds: List<String>)
data class NativePlayerPerformance(
    val id: String, val firstName: String, val lastName: String, val firstNameFr: String?, val lastNameFr: String?,
    val number: Int?, val position: String, val photoUrl: String?, val team: String, val category: String,
    val appearances: Int, val starts: Int, val goals: Int, val assists: Int, val shots: Int, val shotsOnTarget: Int,
    val xg: Double, val xgShots: Int, val yellowCards: Int, val redCards: Int,
    val rightFootShots: Int, val leftFootShots: Int, val headShots: Int,
    val rightFootGoals: Int, val leftFootGoals: Int, val headGoals: Int, val otherGoals: Int,
    val recentMatches: List<NativePlayerMatch>
)
data class NativePlayerMatch(val date: String, val opponent: String, val isStarting: Boolean)
data class NativePlayerStats(val season: String?, val players: List<NativePlayerPerformance>)
data class NativePermissions(val training: Boolean, val news: Boolean, val announcements: Boolean, val scheduleMeetings: Boolean, val updateMatches: Boolean, val playerStats: Boolean, val competitions: Boolean, val manageCompetitions: Boolean, val teamScopeRestricted: Boolean)
data class NativeData(val matches: List<NativeMatch>, val meetings: List<NativeMeeting>, val upcomingMeetings: List<NativeMeeting>, val calendarItems: List<NativeCalendarItem>, val alerts: List<NativeAlert>, val teams: List<NativeTeam>, val coaches: List<NativeCoach>, val competitions: List<NativeCompetition>, val permissions: NativePermissions, val user: NativeUser)
data class NativeUser(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
    val image: String?,
    val licenseNumber: String?,
    val firstName: String? = null,
    val lastName: String? = null,
    val dateOfBirth: String? = null,
    val bloodGroup: String? = null,
    val season: String? = null,
    val licenseRole: String? = null,
    val roleKey: String? = null
)
data class NativeLoginResult(val token: String?, val user: NativeUser?, val error: String?)
data class NativeRelease(val tag: String, val apkUrl: String, val sha256: String?)
class NoPublicNativeRelease : Exception("No publicly accessible Android release is available")
class NativeSessionExpired : Exception("The native session is no longer valid")

fun isNativeUpdateAvailable(releaseTag: String, installedVersion: String): Boolean {
    fun parts(value: String) = Regex("\\d+").findAll(value).take(3).map { it.value.toIntOrNull() ?: 0 }.toList()
    val remote = parts(releaseTag)
    val installed = parts(installedVersion)
    if (remote.isEmpty() || installed.isEmpty()) return releaseTag != installedVersion
    for (index in 0..2) {
        val comparison = remote.getOrElse(index) { 0 }.compareTo(installed.getOrElse(index) { 0 })
        if (comparison != 0) return comparison > 0
    }
    return false
}

object NativeApi {
    private const val BASE_URL = "https://esh-platform-vercel-preview.vercel.app"

    /** Resolve storage paths returned by the platform to an absolute URL for Android's URL loader. */
    fun absolutePublicUrl(value: String): String {
        val source = value.trim()
        if (source.startsWith("data:image/", ignoreCase = true)) return source
        if (source.startsWith("public/", ignoreCase = true)) {
            return "$BASE_URL/api/storage/public-file?key=${java.net.URLEncoder.encode(source, "UTF-8").replace("+", "%20")}"
        }
        if (source.startsWith("//")) return "https:$source"
        if (source.startsWith("http://") || source.startsWith("https://")) return source
        return URL(BASE_URL).toURI().resolve(source.removePrefix("/")).toString()
    }
    private const val CONNECT_TIMEOUT = 20_000
    private const val READ_TIMEOUT = 40_000

    fun login(email: String, password: String, locale: String, rememberMe: Boolean): NativeLoginResult {
        return try {
            val challenge = JSONObject(post("/api/captcha/challenge", "{}"))
            val captchaToken = if (challenge.has("token")) {
                val solutions = solveChallenge(challenge.getString("token"), challenge.getJSONObject("challenge"))
                val redeem = JSONObject().put("token", challenge.getString("token")).put("solutions", JSONArray(solutions))
                JSONObject(post("/api/captcha/redeem", redeem.toString())).optString("token", "")
            } else ""
            val body = JSONObject().put("email", email.trim().lowercase()).put("password", password).put("captchaToken", captchaToken).put("rememberMe", rememberMe)
            val result = JSONObject(post("/api/mobile/auth/login", body.toString()))
            val user = result.getJSONObject("user")
            NativeLoginResult(result.getString("token"), parseUser(user), null)
        } catch (error: ApiFailure) {
            NativeLoginResult(null, null, when (error.code) {
                "invalid_credentials" -> if (locale == "fr") "Adresse e-mail ou mot de passe incorrect." else "البريد الإلكتروني أو كلمة المرور غير صحيحة."
                "admin_access_required" -> if (locale == "fr") "Cette application est réservée aux comptes administratifs autorisés." else "هذا التطبيق مخصص لحسابات الإدارة المصرّح لها."
                "rate_limited" -> if (locale == "fr") "Trop de tentatives. Réessayez dans quelques instants." else "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة."
                "captcha_required", "captcha_unavailable" -> if (locale == "fr") "La vérification de sécurité a échoué. Réessayez." else "تعذر إكمال التحقق الأمني. حاول مرة أخرى."
                else -> if (locale == "fr") "Connexion à la plateforme impossible. Vérifiez votre réseau." else "تعذر الاتصال بالمنصة. تحقق من الإنترنت وحاول مجددًا."
            })
        } catch (_: Exception) {
            NativeLoginResult(null, null, if (locale == "fr") "Connexion à la plateforme impossible. Vérifiez votre réseau." else "تعذر الاتصال بالمنصة. تحقق من الإنترنت وحاول مجددًا.")
        }
    }

    fun session(token: String): NativeUser? {
        val json = JSONObject(get("/api/mobile/session", token))
        val user = json.getJSONObject("user")
        return parseUser(user)
    }

    fun cachedData(context: Context, locale: String): NativeData? {
        val raw = context.getSharedPreferences("esh_native_cache", Context.MODE_PRIVATE)
            .getString("summary_$locale", null) ?: return null
        return runCatching { parseData(JSONObject(raw)) }.getOrNull()
    }

    fun clearCachedData(context: Context) {
        context.getSharedPreferences("esh_native_cache", Context.MODE_PRIVATE).edit().clear().apply()
    }

    fun data(token: String, locale: String, summary: Boolean = false): NativeData {
        val raw = get("/api/mobile/data?locale=$locale${if (summary) "&summary=1" else ""}", token)
        if (summary) {
            // Keep the compact dashboard payload for immediate rendering on the next cold start.
            // The cache contains no bearer token and is stored in the app's private preferences.
            cachePreferences?.edit()?.putString("summary_$locale", raw)?.apply()
        }
        return parseData(JSONObject(raw))
    }

    fun playerStats(token: String): NativePlayerStats {
        val json = JSONObject(get("/api/mobile/player-stats", token))
        val players = json.optJSONArray("players")?.objects()?.map { player ->
            val team = player.optJSONObject("team") ?: JSONObject()
            val recentMatches = player.optJSONArray("recentMatches")?.objects()?.map { match ->
                NativePlayerMatch(match.optString("date"), match.optString("opponent"), match.optBoolean("isStarting"))
            }.orEmpty()
            NativePlayerPerformance(
                player.optString("id"), player.optString("firstName"), player.optString("lastName"), player.optNullableString("firstNameFr"), player.optNullableString("lastNameFr"),
                player.nullableInt("number"), player.optString("position"), player.optNullableString("photoUrl"), team.optString("name"), team.optString("category"),
                player.optInt("appearances"), player.optInt("starts"), player.optInt("goals"), player.optInt("assists"), player.optInt("shots"), player.optInt("shotsOnTarget"),
                player.optDouble("xg"), player.optInt("xgShots"), player.optInt("yellowCards"), player.optInt("redCards"),
                player.optInt("rightFootShots"), player.optInt("leftFootShots"), player.optInt("headShots"), player.optInt("rightFootGoals"), player.optInt("leftFootGoals"), player.optInt("headGoals"), player.optInt("otherGoals"), recentMatches
            )
        }.orEmpty()
        return NativePlayerStats(json.optNullableString("season"), players)
    }

    @Volatile private var cachePreferences: android.content.SharedPreferences? = null

    fun initializeCache(context: Context) {
        cachePreferences = context.applicationContext.getSharedPreferences("esh_native_cache", Context.MODE_PRIVATE)
    }

    private fun parseData(json: JSONObject): NativeData {
        val matches = json.getJSONArray("matches").objects().map { item ->
            val players = item.getJSONArray("players").objects().map { player -> NativePlayer(player.getString("id"), player.optString("name"), player.optString("nameFr"), player.nullableInt("number")) }
            val events = item.getJSONArray("events").objects().map { event -> NativeEvent(event.getString("id"), event.optString("type"), event.optInt("minute"), event.optString("side"), event.optNullableString("playerName"), event.optNullableDouble("xG"), event.optString("source", "MANUAL")) }
            val stats = item.optJSONObject("stats") ?: JSONObject()
            NativeMatch(item.getString("id"), item.optString("opponent"), item.optString("date"), item.optString("status"), item.nullableInt("clubScore"), item.nullableInt("opponentScore"), item.optString("competition"), item.optBoolean("isHomeFixture"), item.optBoolean("canUpdate"), item.optBoolean("canReport"), players, events, stats.optInt("shotsFor"), stats.optInt("shotsAgainst"), stats.optDouble("xgFor"), stats.optDouble("xgAgainst"), stats.optInt("yellowCardsFor"), stats.optInt("redCardsFor"))
        }
        val meetings = json.getJSONArray("meetings").objects().map { item -> NativeMeeting(item.getString("id"), item.optString("title"), item.optString("date"), item.optNullableString("location"), item.optString("status")) }
        val upcoming = json.getJSONArray("upcomingMeetings").objects().map { item -> NativeMeeting(item.getString("id"), item.optString("title"), item.optString("date"), item.optNullableString("location"), "UPCOMING") }
        val calendarItems = json.optJSONArray("calendarItems")?.objects()?.map { item -> NativeCalendarItem(item.optString("id"), item.optString("type", "OTHER"), item.optString("title"), item.optString("startDateTime"), item.optString("endDateTime"), item.optNullableString("location"), item.optNullableString("team"), if (item.has("isHomeFixture") && !item.isNull("isHomeFixture")) item.optBoolean("isHomeFixture") else null, item.optNullableString("opponentLogo")) }.orEmpty()
        val alerts = json.getJSONArray("notifications").objects().map { item -> NativeAlert(item.getString("id"), item.optString("title"), item.optNullableString("message"), item.optBoolean("isRead"), "MATCH") } + upcoming.map { meeting -> NativeAlert("meeting-${meeting.id}", meeting.title, meeting.location, false, "MEETING") }
        val teams = json.optJSONArray("teams")?.objects()?.map { NativeTeam(it.optString("id"), it.optString("name"), it.optString("category")) }.orEmpty()
        val coaches = json.optJSONArray("coaches")?.objects()?.map { item ->
            NativeCoach(item.optString("id"), item.optString("name"), item.optJSONArray("teamIds")?.let { ids -> (0 until ids.length()).map { ids.optString(it) } }.orEmpty())
        }.orEmpty()
        val competitions = json.optJSONArray("competitions")?.objects()?.map { item ->
            val standings = item.optJSONArray("standings")?.objects()?.map { row ->
                NativeStanding(row.optString("id"), row.optInt("rank"), row.optString("teamName"), row.optNullableString("teamLogo"), row.optBoolean("isOurClub"), row.optInt("played"), row.optInt("won"), row.optInt("drawn"), row.optInt("lost"), row.optInt("goalsFor"), row.optInt("goalsAgainst"), row.optInt("goalDifference"), row.optInt("points"), row.optJSONArray("form")?.let { form -> (0 until form.length()).map { form.optString(it) } }.orEmpty())
            }.orEmpty()
            NativeCompetition(item.optString("id"), item.optString("name"), item.optString("type"), item.optNullableString("logoUrl"), item.optNullableString("organization"), item.optString("seasonLabel"), item.optString("category"), item.optString("categoryLabel"), standings, item.optBoolean("canManage"))
        }.orEmpty()
        val permissions = json.optJSONObject("permissions") ?: JSONObject()
        val user = parseUser(json.optJSONObject("user") ?: JSONObject())
        return NativeData(matches, meetings, upcoming, calendarItems, alerts, teams, coaches, competitions, NativePermissions(permissions.optBoolean("training"), permissions.optBoolean("news"), permissions.optBoolean("announcements"), permissions.optBoolean("scheduleMeetings"), permissions.optBoolean("updateMatches"), permissions.optBoolean("playerStats"), permissions.optBoolean("competitions"), permissions.optBoolean("manageCompetitions"), permissions.optBoolean("teamScopeRestricted")), user)
    }

    fun createContent(token: String, payload: JSONObject) {
        request("/api/mobile/content", token, payload.toString(), "POST")
    }

    fun uploadNewsImage(context: Context, token: String, uri: Uri): String {
        val mime = context.contentResolver.getType(uri)?.takeIf { it in listOf("image/jpeg", "image/png", "image/webp") }
            ?: throw IllegalArgumentException("صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP.")
        val bytes = context.contentResolver.openInputStream(uri)?.use { input ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(16 * 1024)
            var total = 0
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                total += count
                if (total > 4 * 1024 * 1024) throw IllegalArgumentException("يجب ألا يتجاوز حجم الصورة 4 ميغابايت.")
                output.write(buffer, 0, count)
            }
            output.toByteArray()
        } ?: throw IllegalArgumentException("تعذر قراءة الصورة المحددة.")
        if (bytes.isEmpty()) throw IllegalArgumentException("الصورة المحددة فارغة.")
        val boundary = "----ESH${System.currentTimeMillis()}${(1000..9999).random()}"
        val connection = URL("$BASE_URL/api/mobile/news/media").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = CONNECT_TIMEOUT
            connection.readTimeout = READ_TIMEOUT
            connection.doOutput = true
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            connection.outputStream.use { output ->
                output.write("--$boundary\r\nContent-Disposition: form-data; name=\"image\"; filename=\"news-image\"\r\nContent-Type: $mime\r\n\r\n".toByteArray(Charsets.UTF_8))
                output.write(bytes)
                output.write("\r\n--$boundary--\r\n".toByteArray(Charsets.UTF_8))
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status == HttpURLConnection.HTTP_UNAUTHORIZED) throw NativeSessionExpired()
            if (status !in 200..299) throw ApiFailure(runCatching { JSONObject(text).optString("error") }.getOrDefault("image_upload_failed"))
            return JSONObject(text).getString("url")
        } finally { connection.disconnect() }
    }

    fun registerPush(token: String, fcmToken: String, locale: String) {
        request("/api/mobile/devices", token, JSONObject().put("fcmToken", fcmToken).put("locale", locale).toString(), "POST")
    }

    fun unregisterPush(token: String, fcmToken: String) {
        request("/api/mobile/devices", token, JSONObject().put("fcmToken", fcmToken).toString(), "DELETE")
    }

    fun logout(token: String) {
        request("/api/mobile/session", token, null, "DELETE")
    }

    fun latestRelease(): NativeRelease? {
        val connection = URL("$BASE_URL/native-android-release.json?t=${System.currentTimeMillis()}").openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 7_000
            connection.readTimeout = 9_000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cache-Control", "no-cache")
            when (connection.responseCode) {
                404 -> throw NoPublicNativeRelease()
                in 200..299 -> Unit
                else -> throw ApiFailure("release_check_failed")
            }
            val release = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
            val tag = release.optString("version").takeIf { it.isNotBlank() } ?: return null
            val apkPath = release.optString("apkUrl").takeIf { it.isNotBlank() } ?: return null
            val apkUrl = if (apkPath.startsWith("https://")) apkPath else URL(URL(BASE_URL), apkPath.removePrefix("/")).toString()
            if (!apkUrl.startsWith("https://")) return null
            return NativeRelease(tag, apkUrl, release.optString("sha256").takeIf { it.matches(Regex("(?i)[a-f0-9]{64}")) })
        } finally { connection.disconnect() }
    }

    /** Download and verify an APK without handing the transfer to Android DownloadManager. */
    suspend fun downloadApk(
        apkUrl: String,
        destination: File,
        expectedSha256: String?,
        onProgress: suspend (Int) -> Unit
    ) {
        val connection = URL(apkUrl).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.setRequestProperty("Accept", "application/vnd.android.package-archive")
            if (connection.responseCode !in 200..299) throw ApiFailure("update_download_failed")
            val total = connection.contentLengthLong
            destination.parentFile?.mkdirs()
            val digest = MessageDigest.getInstance("SHA-256")
            var downloaded = 0L
            connection.inputStream.use { input ->
                FileOutputStream(destination).use { output ->
                    val buffer = ByteArray(32 * 1024)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        output.write(buffer, 0, count)
                        digest.update(buffer, 0, count)
                        downloaded += count
                        if (total > 0L) onProgress((downloaded * 100L / total).toInt().coerceIn(0, 99))
                    }
                    output.fd.sync()
                }
            }
            val actualSha256 = digest.digest().joinToString("") { "%02x".format(it) }
            if (!expectedSha256.isNullOrBlank() && !actualSha256.equals(expectedSha256, ignoreCase = true)) {
                destination.delete()
                throw ApiFailure("update_checksum_mismatch")
            }
            onProgress(100)
        } catch (error: Throwable) {
            destination.delete()
            throw error
        } finally {
            connection.disconnect()
        }
    }

    fun updateScore(token: String, matchId: String, homeScore: Int, awayScore: Int, status: String? = null) {
        val body = JSONObject().put("homeScore", homeScore).put("awayScore", awayScore)
        status?.let { body.put("status", it) }
        request("/api/mobile/matches/$matchId/score", token, body.toString(), "PATCH")
    }

    fun addGoal(token: String, matchId: String, side: String, minute: Int, playerId: String?, playerName: String?) {
        val body = JSONObject().put("type", "GOAL").put("side", side).put("minute", minute).put("bodyPart", "FOOT")
        playerId?.let { body.put("playerId", it) }
        playerName?.let { body.put("playerName", it) }
        request("/api/mobile/matches/$matchId/events", token, body.toString(), "POST")
    }

    fun addMatchEvent(token: String, matchId: String, payload: JSONObject) {
        request("/api/mobile/matches/$matchId/events", token, payload.toString(), "POST")
    }

    fun deleteMatchEvent(token: String, matchId: String, eventId: String) {
        request("/api/mobile/matches/$matchId/events/$eventId", token, null, "DELETE")
    }

    fun deleteNotification(token: String, notificationId: String) {
        request("/api/mobile/notifications/${Uri.encode(notificationId)}", token, null, "DELETE")
    }

    fun deleteAllNotifications(token: String) {
        request("/api/mobile/notifications", token, null, "DELETE")
    }

    fun updateCompetitionStandings(token: String, competitionId: String, standings: List<NativeStanding>) {
        val rows = JSONArray()
        standings.forEach { row ->
            rows.put(JSONObject().put("id", row.id).put("rank", row.rank).put("teamName", row.teamName).put("teamLogo", row.teamLogo)
                .put("isOurClub", row.isOurClub).put("played", row.played).put("won", row.won).put("drawn", row.drawn).put("lost", row.lost)
                .put("goalsFor", row.goalsFor).put("goalsAgainst", row.goalsAgainst).put("goalDifference", row.goalDifference).put("points", row.points).put("form", JSONArray(row.form)))
        }
        request("/api/mobile/competitions/$competitionId/standings", token, JSONObject().put("standings", rows).toString(), "PATCH")
    }

    private fun solveChallenge(token: String, challenge: JSONObject): List<Long> {
        val count = challenge.getInt("c")
        val size = challenge.getInt("s")
        val difficulty = challenge.getInt("d")
        val tokenHash = fnv1a(token)
        val solutions = ArrayList<Long>(count)
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = ByteArray(digest.digestLength)
        val nonceBytes = ByteArray(20)
        for (index in 1..count) {
            val saltSeed = fnvResume(tokenHash, index.toString())
            val targetSeed = fnvResume(saltSeed, "d")
            val saltBytes = prng(saltSeed, size).toByteArray(Charsets.UTF_8)
            val target = prng(targetSeed, difficulty)
            var nonce = 0L
            while (true) {
                if (Thread.currentThread().isInterrupted) throw InterruptedException("CAPTCHA solve cancelled")
                digest.update(saltBytes)
                var value = nonce
                var cursor = nonceBytes.size
                do {
                    nonceBytes[--cursor] = ('0'.code + (value % 10).toInt()).toByte()
                    value /= 10
                } while (value > 0)
                digest.update(nonceBytes, cursor, nonceBytes.size - cursor)
                digest.digest(hashBytes, 0, hashBytes.size)
                if (hashStartsWithHex(hashBytes, target)) break
                nonce++
            }
            solutions.add(nonce)
        }
        return solutions
    }

    /** Compare the challenge's hex prefix directly, avoiding millions of String.format calls on phones. */
    private fun hashStartsWithHex(hash: ByteArray, target: String): Boolean {
        for (index in target.indices) {
            val byte = hash[index ushr 1].toInt() and 0xff
            val actual = if ((index and 1) == 0) byte ushr 4 else byte and 0x0f
            val expected = target[index].digitToIntOrNull(16) ?: return false
            if (actual != expected) return false
        }
        return true
    }

    private fun fnv1a(value: String): Int = fnvResume(2166136261L.toInt(), value)
    private fun fnvResume(initial: Int, value: String): Int {
        var hash = initial
        for (char in value) {
            hash = hash xor char.code
            hash += (hash shl 1) + (hash shl 4) + (hash shl 7) + (hash shl 8) + (hash shl 24)
        }
        return hash
    }
    private fun prng(initial: Int, length: Int): String {
        var state = initial
        val out = StringBuilder()
        while (out.length < length) {
            state = state xor (state shl 13)
            state = state xor (state ushr 17)
            state = state xor (state shl 5)
            out.append(Integer.toUnsignedString(state, 16).padStart(8, '0'))
        }
        return out.substring(0, length)
    }
    private fun post(path: String, body: String): String = request(path, null, body, "POST")
    private fun get(path: String, token: String): String = request(path, token, null)

    private fun request(path: String, token: String?, body: String?, method: String = "GET"): String {
        val connection = URL(BASE_URL + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = CONNECT_TIMEOUT
            connection.readTimeout = READ_TIMEOUT
            connection.setRequestProperty("Accept", "application/json")
            if (token != null) connection.setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status == HttpURLConnection.HTTP_UNAUTHORIZED && token != null) throw NativeSessionExpired()
            if (status !in 200..299) throw ApiFailure(runCatching { JSONObject(text).optString("error") }.getOrDefault("request_failed"))
            return text
        } finally { connection.disconnect() }
    }

    private fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }
    private fun JSONObject.nullableInt(key: String): Int? = if (isNull(key)) null else optInt(key)
    private fun JSONObject.optNullableDouble(key: String): Double? = if (isNull(key) || !has(key)) null else optDouble(key)
    private fun JSONObject.optNullableString(key: String): String? = if (isNull(key)) null else optString(key)
    private fun parseUser(user: JSONObject): NativeUser = NativeUser(
        user.optString("id"), user.optString("name"), user.optString("email"), user.optString("roleName"),
        user.optNullableString("image"), user.optNullableString("licenseNumber"), user.optNullableString("firstName"),
        user.optNullableString("lastName"), user.optNullableString("dateOfBirth"), user.optNullableString("bloodGroup"),
        user.optNullableString("season"), user.optNullableString("licenseRole"), user.optNullableString("roleKey")
    )
    private class ApiFailure(val code: String) : Exception(code)
}
