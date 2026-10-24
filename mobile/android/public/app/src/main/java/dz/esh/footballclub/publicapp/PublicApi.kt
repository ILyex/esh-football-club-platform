package dz.esh.footballclub.publicapp

import android.content.Context
import java.io.File
import java.security.MessageDigest
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

private const val PUBLIC_API_ORIGIN = "https://esh-platform-vercel-preview.vercel.app"

data class PublicClub(val name: String, val shortName: String, val logo: String?, val hero: String?, val description: String?, val stadium: String?)
data class PublicTeam(val id: String, val category: String, val name: String, val description: String?, val birthYearFrom: Int?, val birthYearTo: Int?, val playerCount: Int)
data class PublicStanding(val id: String, val rank: Int, val teamName: String, val teamLogo: String?, val isOurClub: Boolean, val played: Int, val won: Int, val drawn: Int, val lost: Int, val goalsFor: Int, val goalsAgainst: Int, val goalDifference: Int, val points: Int)
data class PublicCompetition(val id: String, val name: String, val organization: String?, val season: String, val category: String, val standings: List<PublicStanding>)
data class PublicMatch(val id: String, val home: String, val away: String, val date: String, val status: String, val homeScore: Int?, val awayScore: Int?, val competition: String, val category: String?, val stadium: String?, val opponentLogo: String?, val isHomeFixture: Boolean = false)
data class PublicTraining(val id: String, val date: String, val start: String, val end: String, val location: String?, val category: String, val team: String)
data class PublicNews(val id: String, val slug: String, val title: String, val excerpt: String, val image: String?, val category: String?, val date: String)
data class PublicAnnouncement(val id: String, val title: String, val content: String, val priority: String)
data class PublicPhoto(val id: String, val url: String, val caption: String?)
data class PublicAlbum(val id: String, val name: String, val description: String?, val cover: String?, val count: Int, val category: String, val photos: List<PublicPhoto>)
data class PublicReel(val id: String, val title: String, val url: String, val platform: String)
data class PublicSnapshot(val club: PublicClub, val nextMatch: PublicMatch?, val matches: List<PublicMatch>, val results: List<PublicMatch>, val trainings: List<PublicTraining>, val news: List<PublicNews>, val announcements: List<PublicAnnouncement>, val albums: List<PublicAlbum>, val reels: List<PublicReel>, val teams: List<PublicTeam>, val competitions: List<PublicCompetition>)
data class PublicAlert(val id: String, val title: String, val body: String, val time: Long, val kind: String)
data class PublicMatchEvent(val id: String, val minute: Int, val type: String, val player: String)
data class PublicMatchCenter(val match: PublicMatch, val events: List<PublicMatchEvent>, val starting: List<String>, val substitutes: List<String>, val report: String?)
data class PublicArticle(val title: String, val content: String, val image: String?, val category: String?, val date: String)
data class PublicRelease(val version: String, val apkUrl: String, val sha256: String?)

object PublicApi {
    private const val CACHE_PREFS = "esh_public_content_cache"

    fun fetch(context: Context, locale: String): PublicSnapshot {
        val response = request("/api/public/mobile?locale=$locale")
        // Keep the last good public feed on-device. If a later launch has no
        // connection, supporters still get the latest saved fixtures/news.
        context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE)
            .edit().putString("snapshot_$locale", response).apply()
        return parse(response)
    }

    fun cachedSnapshot(context: Context, locale: String): PublicSnapshot? = runCatching {
        context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE)
            .getString("snapshot_$locale", null)?.let(::parse)
    }.getOrNull()

    fun teams(locale: String): List<PublicTeam> = JSONObject(request("/api/public/mobile/teams?locale=$locale&t=${System.currentTimeMillis()}"))
        .optJSONArray("teams").objects().map { item ->
            PublicTeam(item.optString("id"), item.optString("category"), item.optString("name"), item.optNullable("description"), item.intOrNull("birthYearFrom"), item.intOrNull("birthYearTo"), item.optInt("playerCount"))
        }

    fun competitions(locale: String): List<PublicCompetition> = JSONObject(request("/api/public/mobile/competitions?locale=$locale&t=${System.currentTimeMillis()}"))
        .optJSONArray("competitions").objects().map { item ->
            PublicCompetition(
                item.optString("id"), item.optString("name"), item.optNullable("organization"), item.optString("seasonLabel"), item.optString("category"),
                item.optJSONArray("standings").objects().map { row -> PublicStanding(
                    row.optString("id"), row.optInt("rank"), row.optString("teamName"), row.url("teamLogo"), row.optBoolean("isOurClub"),
                    row.optInt("played"), row.optInt("won"), row.optInt("drawn"), row.optInt("lost"), row.optInt("goalsFor"),
                    row.optInt("goalsAgainst"), row.optInt("goalDifference"), row.optInt("points")
                ) }
            )
        }

    fun latestRelease(): PublicRelease? {
        val release = JSONObject(request("/public-android-release.json?t=${System.currentTimeMillis()}"))
        val version = release.optString("version").takeIf { it.isNotBlank() } ?: return null
        val path = release.optString("apkUrl").takeIf { it.isNotBlank() } ?: return null
        val url = if (path.startsWith("https://")) path else URL(URL(PUBLIC_API_ORIGIN), path.removePrefix("/")).toString()
        if (!url.startsWith("https://")) return null
        val checksum = release.optString("sha256").takeIf { it.matches(Regex("(?i)[a-f0-9]{64}")) }
        return PublicRelease(version, url, checksum)
    }

    fun downloadApk(context: Context, release: PublicRelease, onProgress: (Int) -> Unit): File {
        require(release.apkUrl.startsWith("https://"))
        val updateDirectory = File(context.cacheDir, "updates").apply { mkdirs() }
        val versionTag = release.version.replace(Regex("[^A-Za-z0-9._-]"), "_")
        val destination = File(updateDirectory, "esh-update-$versionTag.apk")
        if (destination.exists()) destination.delete()
        val connection = URL(release.apkUrl).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 30_000
            connection.readTimeout = 120_000
            connection.instanceFollowRedirects = true
            connection.useCaches = false
            connection.setRequestProperty("User-Agent", "ESH-Public-Android-Updater")
            connection.setRequestProperty("Cache-Control", "no-cache")
            if (connection.responseCode !in 200..299) error("update_download_failed")
            val total = connection.contentLengthLong
            val digest = MessageDigest.getInstance("SHA-256")
            var received = 0L
            connection.inputStream.use { input -> destination.outputStream().use { output ->
                val buffer = ByteArray(24 * 1024)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    output.write(buffer, 0, count)
                    digest.update(buffer, 0, count)
                    received += count
                    if (total > 0) onProgress(((received * 100L) / total).toInt().coerceIn(0, 99))
                }
            } }
            if (destination.length() == 0L) error("update_empty_file")
            val actual = digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
            if (release.sha256 != null && !release.sha256.equals(actual, ignoreCase = true)) error("update_checksum_mismatch")
            onProgress(100)
            return destination
        } catch (error: Throwable) {
            destination.delete()
            throw error
        } finally { connection.disconnect() }
    }

    fun isUpdateAvailable(remote: String, installed: String): Boolean {
        fun parts(value: String) = Regex("\\d+").findAll(value).take(3).map { it.value.toIntOrNull() ?: 0 }.toList()
        val next = parts(remote)
        val current = parts(installed)
        if (next.isEmpty() || current.isEmpty()) return remote != installed
        for (index in 0..2) {
            val comparison = next.getOrElse(index) { 0 }.compareTo(current.getOrElse(index) { 0 })
            if (comparison != 0) return comparison > 0
        }
        return false
    }

    private fun parse(response: String): PublicSnapshot {
        val json = JSONObject(response)
        val clubJson = json.getJSONObject("club")
        return PublicSnapshot(
            club = PublicClub(clubJson.optString("name"), clubJson.optString("shortName", "ESH"), clubJson.url("logoUrl"), clubJson.url("heroImageUrl"), clubJson.optNullable("description"), clubJson.optNullable("stadium")),
            nextMatch = json.optJSONObject("nextMatch")?.let(::match),
            matches = json.optJSONArray("matches").objects().map(::match),
            results = json.optJSONArray("recentResults").objects().map(::match),
            trainings = json.optJSONArray("trainings").objects().map { item -> PublicTraining(item.optString("id"), item.optString("date"), item.optString("startTime"), item.optString("endTime"), item.optNullable("location"), item.optString("teamCategory", "SENIOR"), item.optString("teamName")) },
            news = json.optJSONArray("news").objects().map { item -> PublicNews(item.optString("id"), item.optString("slug"), item.optString("title"), item.optString("excerpt"), item.url("featuredImageUrl"), item.optNullable("category"), item.optString("publishedAt")) },
            announcements = json.optJSONArray("announcements").objects().map { item -> PublicAnnouncement(item.optString("id"), item.optString("title"), item.optString("content"), item.optString("priority")) },
            albums = json.optJSONArray("albums").objects().map { item -> PublicAlbum(item.optString("id"), item.optString("name"), item.optNullable("description"), item.url("coverImageUrl"), item.optInt("photoCount"), item.optString("category"), item.optJSONArray("samplePhotos").objects().map { photo -> PublicPhoto(photo.optString("id"), photo.optString("url"), photo.optNullable("caption")) }) },
            reels = json.optJSONArray("reels").objects().map { item -> PublicReel(item.optString("id"), item.optString("title"), item.optString("url"), item.optString("platform")) },
            teams = json.optJSONArray("teams").objects().map { item -> PublicTeam(item.optString("id"), item.optString("category"), item.optString("name"), item.optNullable("description"), item.intOrNull("birthYearFrom"), item.intOrNull("birthYearTo"), item.optInt("playerCount")) },
            competitions = json.optJSONArray("competitions").objects().map { item ->
                PublicCompetition(
                    item.optString("id"), item.optString("name"), item.optNullable("organization"),
                    item.optString("seasonLabel"), item.optString("category"),
                    item.optJSONArray("standings").objects().map { row ->
                        PublicStanding(
                            row.optString("id"), row.optInt("rank"), row.optString("teamName"), row.url("teamLogo"),
                            row.optBoolean("isOurClub"), row.optInt("played"), row.optInt("won"), row.optInt("drawn"),
                            row.optInt("lost"), row.optInt("goalsFor"), row.optInt("goalsAgainst"),
                            row.optInt("goalDifference"), row.optInt("points")
                        )
                    }
                )
            }
        )
    }

    fun matchCenter(id: String): PublicMatchCenter {
        val item = JSONObject(request("/api/public/mobile/matches/${encode(id)}"))
        val match = match(item)
        val events = item.optJSONArray("events").objects().map { event ->
            val name = if (event.optString("playerNameFr").isNotBlank()) event.optString("playerNameFr") else event.optString("playerName")
            PublicMatchEvent(event.optString("id"), event.optInt("minute"), event.optString("type"), name)
        }
        val starting = item.optJSONArray("startingLineup").objects().map { it.optString("playerName") }
        val substitutes = item.optJSONArray("substitutes").objects().map { it.optString("playerName") }
        return PublicMatchCenter(match, events, starting, substitutes, item.optNullable("matchReport"))
    }

    fun article(slug: String, locale: String): PublicArticle {
        val item = JSONObject(request("/api/public/mobile/news/${encode(slug)}?locale=$locale"))
        return PublicArticle(item.optString("title"), item.optString("content").replace(Regex("<[^>]*>"), " ").replace(Regex("\\s+"), " ").trim(), item.url("featuredImageUrl"), item.optNullable("category"), item.optString("publishedAt"))
    }

    fun album(id: String): PublicAlbum {
        val item = JSONObject(request("/api/public/mobile/gallery/${encode(id)}"))
        return PublicAlbum(item.optString("id"), item.optString("name"), item.optNullable("description"), item.url("coverImageUrl"), item.optInt("photoCount"), item.optString("category"), item.optJSONArray("photos").objects().map { photo -> PublicPhoto(photo.optString("id"), photo.optString("url"), photo.optNullable("caption")) })
    }

    fun registerDevice(token: String, locale: String) {
        request("/api/public/mobile/devices", JSONObject().put("fcmToken", token).put("locale", locale).toString(), "POST")
    }

    fun unregisterDevice(token: String) {
        request("/api/public/mobile/devices", JSONObject().put("fcmToken", token).toString(), "DELETE")
    }

    private fun match(item: JSONObject) = PublicMatch(
        id = item.optString("id"), home = item.optString("homeTeamName"), away = item.optString("awayTeamName"), date = item.optString("matchDate"),
        status = item.optString("status"), homeScore = item.intOrNull("homeScore"), awayScore = item.intOrNull("awayScore"),
        competition = item.optString("competitionName"), category = item.optNullable("teamCategory"), stadium = item.optNullable("stadium"), opponentLogo = item.url("opponentLogo"), isHomeFixture = item.optBoolean("isHomeFixture")
    )

    private fun request(path: String, body: String? = null, method: String = "GET"): String {
        val connection = URL(PUBLIC_API_ORIGIN + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 8_000
            connection.readTimeout = 10_000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("User-Agent", "ESH-Public-Android/1.0")
            connection.useCaches = false
            connection.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0")
            connection.setRequestProperty("Pragma", "no-cache")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status !in 200..299) throw IllegalStateException("public_api_$status")
            if (response.isBlank()) throw IllegalStateException("public_api_empty_response")
            return response
        } finally { connection.disconnect() }
    }

    private fun encode(value: String) = URLEncoder.encode(value, "UTF-8").replace("+", "%20")
    private fun JSONArray?.objects(): List<JSONObject> = this?.let { array -> (0 until array.length()).mapNotNull { array.optJSONObject(it) } }.orEmpty()
    private fun JSONObject.optNullable(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }
    private fun JSONObject.url(key: String): String? = optNullable(key)?.let { if (it.startsWith("/")) PUBLIC_API_ORIGIN + it else it }
    private fun JSONObject.intOrNull(key: String): Int? = if (!has(key) || isNull(key)) null else optInt(key)
}
