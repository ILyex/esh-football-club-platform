package dz.esh.footballclub.field

import android.content.Context
import android.net.Uri
import java.io.ByteArrayOutputStream
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
data class NativeAlert(val id: String, val title: String, val message: String?, val read: Boolean, val kind: String = "MATCH")
data class NativeTeam(val id: String, val name: String, val category: String)
data class NativeCoach(val id: String, val name: String, val teamIds: List<String>)
data class NativePermissions(val training: Boolean, val news: Boolean, val announcements: Boolean, val scheduleMeetings: Boolean, val updateMatches: Boolean, val teamScopeRestricted: Boolean)
data class NativeData(val matches: List<NativeMatch>, val meetings: List<NativeMeeting>, val upcomingMeetings: List<NativeMeeting>, val alerts: List<NativeAlert>, val teams: List<NativeTeam>, val coaches: List<NativeCoach>, val permissions: NativePermissions, val user: NativeUser)
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
    val season: String? = null
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
        val alerts = json.getJSONArray("notifications").objects().map { item -> NativeAlert(item.getString("id"), item.optString("title"), item.optNullableString("message"), item.optBoolean("isRead"), "MATCH") } + upcoming.map { meeting -> NativeAlert("meeting-${meeting.id}", meeting.title, meeting.location, false, "MEETING") }
        val teams = json.optJSONArray("teams")?.objects()?.map { NativeTeam(it.optString("id"), it.optString("name"), it.optString("category")) }.orEmpty()
        val coaches = json.optJSONArray("coaches")?.objects()?.map { item ->
            NativeCoach(item.optString("id"), item.optString("name"), item.optJSONArray("teamIds")?.let { ids -> (0 until ids.length()).map { ids.optString(it) } }.orEmpty())
        }.orEmpty()
        val permissions = json.optJSONObject("permissions") ?: JSONObject()
        val user = parseUser(json.optJSONObject("user") ?: JSONObject())
        return NativeData(matches, meetings, upcoming, alerts, teams, coaches, NativePermissions(permissions.optBoolean("training"), permissions.optBoolean("news"), permissions.optBoolean("announcements"), permissions.optBoolean("scheduleMeetings"), permissions.optBoolean("updateMatches"), permissions.optBoolean("teamScopeRestricted")), user)
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
        user.optNullableString("season")
    )
    private class ApiFailure(val code: String) : Exception(code)
}
