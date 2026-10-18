package dz.esh.footballclub.field

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
    val events: List<NativeEvent>
)

data class NativePlayer(val id: String, val name: String, val nameFr: String, val number: Int?)
data class NativeEvent(val id: String, val type: String, val minute: Int, val side: String, val playerName: String?)
data class NativeMeeting(val id: String, val title: String, val date: String, val location: String?, val status: String)
data class NativeAlert(val id: String, val title: String, val message: String?, val read: Boolean)
data class NativeTeam(val id: String, val name: String, val category: String)
data class NativePermissions(val training: Boolean, val news: Boolean, val announcements: Boolean, val teamScopeRestricted: Boolean)
data class NativeData(val matches: List<NativeMatch>, val meetings: List<NativeMeeting>, val upcomingMeetings: List<NativeMeeting>, val alerts: List<NativeAlert>, val teams: List<NativeTeam>, val permissions: NativePermissions)
data class NativeUser(val name: String, val email: String, val role: String)
data class NativeLoginResult(val token: String?, val user: NativeUser?, val error: String?)

object NativeApi {
    private const val BASE_URL = "https://esh-platform-vercel-preview.vercel.app"
    private const val CONNECT_TIMEOUT = 20_000
    private const val READ_TIMEOUT = 40_000

    fun login(email: String, password: String, locale: String): NativeLoginResult {
        return try {
            val challenge = JSONObject(post("/api/captcha/challenge", "{}"))
            val captchaToken = if (challenge.has("token")) {
                val solutions = solveChallenge(challenge.getString("token"), challenge.getJSONObject("challenge"))
                val redeem = JSONObject().put("token", challenge.getString("token")).put("solutions", JSONArray(solutions))
                JSONObject(post("/api/captcha/redeem", redeem.toString())).optString("token", "")
            } else ""
            val body = JSONObject().put("email", email.trim().lowercase()).put("password", password).put("captchaToken", captchaToken)
            val result = JSONObject(post("/api/mobile/auth/login", body.toString()))
            val user = result.getJSONObject("user")
            NativeLoginResult(result.getString("token"), NativeUser(user.optString("name"), user.optString("email"), user.optString("roleName")), null)
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
        return NativeUser(user.optString("name"), user.optString("email"), user.optString("roleName"))
    }

    fun data(token: String, locale: String): NativeData {
        val json = JSONObject(get("/api/mobile/data?locale=$locale", token))
        val matches = json.getJSONArray("matches").objects().map { item ->
            val players = item.getJSONArray("players").objects().map { player -> NativePlayer(player.getString("id"), player.optString("name"), player.optString("nameFr"), player.nullableInt("number")) }
            val events = item.getJSONArray("events").objects().map { event -> NativeEvent(event.getString("id"), event.optString("type"), event.optInt("minute"), event.optString("side"), event.optNullableString("playerName")) }
            NativeMatch(item.getString("id"), item.optString("opponent"), item.optString("date"), item.optString("status"), item.nullableInt("clubScore"), item.nullableInt("opponentScore"), item.optString("competition"), item.optBoolean("isHomeFixture"), item.optBoolean("canUpdate"), item.optBoolean("canReport"), players, events)
        }
        val meetings = json.getJSONArray("meetings").objects().map { item -> NativeMeeting(item.getString("id"), item.optString("title"), item.optString("date"), item.optNullableString("location"), item.optString("status")) }
        val upcoming = json.getJSONArray("upcomingMeetings").objects().map { item -> NativeMeeting(item.getString("id"), item.optString("title"), item.optString("date"), item.optNullableString("location"), "UPCOMING") }
        val alerts = json.getJSONArray("notifications").objects().map { item -> NativeAlert(item.getString("id"), item.optString("title"), item.optNullableString("message"), item.optBoolean("isRead")) }
        val teams = json.optJSONArray("teams")?.objects()?.map { NativeTeam(it.optString("id"), it.optString("name"), it.optString("category")) }.orEmpty()
        val permissions = json.optJSONObject("permissions") ?: JSONObject()
        return NativeData(matches, meetings, upcoming, alerts, teams, NativePermissions(permissions.optBoolean("training"), permissions.optBoolean("news"), permissions.optBoolean("announcements"), permissions.optBoolean("teamScopeRestricted")))
    }

    fun createContent(token: String, payload: JSONObject) {
        request("/api/mobile/content", token, payload.toString(), "POST")
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

    private fun solveChallenge(token: String, challenge: JSONObject): List<Long> {
        val count = challenge.getInt("c")
        val size = challenge.getInt("s")
        val difficulty = challenge.getInt("d")
        val tokenHash = fnv1a(token)
        val solutions = ArrayList<Long>(count)
        val digest = MessageDigest.getInstance("SHA-256")
        for (index in 1..count) {
            val saltSeed = fnvResume(tokenHash, index.toString())
            val targetSeed = fnvResume(saltSeed, "d")
            val salt = prng(saltSeed, size)
            val target = prng(targetSeed, difficulty)
            var nonce = 0L
            while (true) {
                if (Thread.currentThread().isInterrupted) throw InterruptedException("CAPTCHA solve cancelled")
                val hash = digest.digest("$salt$nonce".toByteArray(Charsets.UTF_8)).toHex()
                if (hash.startsWith(target)) break
                nonce++
            }
            solutions.add(nonce)
        }
        return solutions
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
    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }

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
            if (status !in 200..299) throw ApiFailure(runCatching { JSONObject(text).optString("error") }.getOrDefault("request_failed"))
            return text
        } finally { connection.disconnect() }
    }

    private fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }
    private fun JSONObject.nullableInt(key: String): Int? = if (isNull(key)) null else optInt(key)
    private fun JSONObject.optNullableString(key: String): String? = if (isNull(key)) null else optString(key)
    private class ApiFailure(val code: String) : Exception(code)
}
