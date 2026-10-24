package dz.esh.footballclub.publicapp

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

private const val PUBLIC_API_ORIGIN = "https://esh-platform-vercel-preview.vercel.app"

data class PublicClub(val name: String, val shortName: String, val logo: String?, val hero: String?, val description: String?, val stadium: String?)
data class PublicMatch(val id: String, val home: String, val away: String, val date: String, val status: String, val homeScore: Int?, val awayScore: Int?, val competition: String, val category: String?, val stadium: String?, val opponentLogo: String?)
data class PublicTraining(val id: String, val date: String, val start: String, val end: String, val location: String?, val category: String, val team: String)
data class PublicNews(val id: String, val slug: String, val title: String, val excerpt: String, val image: String?, val category: String?, val date: String)
data class PublicAnnouncement(val id: String, val title: String, val content: String, val priority: String)
data class PublicPhoto(val id: String, val url: String, val caption: String?)
data class PublicAlbum(val id: String, val name: String, val description: String?, val cover: String?, val count: Int, val category: String, val photos: List<PublicPhoto>)
data class PublicReel(val id: String, val title: String, val url: String, val platform: String)
data class PublicSnapshot(val club: PublicClub, val nextMatch: PublicMatch?, val matches: List<PublicMatch>, val results: List<PublicMatch>, val trainings: List<PublicTraining>, val news: List<PublicNews>, val announcements: List<PublicAnnouncement>, val albums: List<PublicAlbum>, val reels: List<PublicReel>)
data class PublicAlert(val id: String, val title: String, val body: String, val time: Long, val kind: String)
data class PublicMatchEvent(val id: String, val minute: Int, val type: String, val player: String)
data class PublicMatchCenter(val match: PublicMatch, val events: List<PublicMatchEvent>, val starting: List<String>, val substitutes: List<String>, val report: String?)
data class PublicArticle(val title: String, val content: String, val image: String?, val category: String?, val date: String)

object PublicApi {
    fun fetch(locale: String): PublicSnapshot {
        val json = JSONObject(request("/api/public/mobile?locale=$locale"))
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
            reels = json.optJSONArray("reels").objects().map { item -> PublicReel(item.optString("id"), item.optString("title"), item.optString("url"), item.optString("platform")) }
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
        competition = item.optString("competitionName"), category = item.optNullable("teamCategory"), stadium = item.optNullable("stadium"), opponentLogo = item.url("opponentLogo")
    )

    private fun request(path: String, body: String? = null, method: String = "GET"): String {
        val connection = URL(PUBLIC_API_ORIGIN + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 15_000
            connection.readTimeout = 20_000
            connection.setRequestProperty("Accept", "application/json")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status !in 200..299) throw IllegalStateException("public_api_$status")
            return response
        } finally { connection.disconnect() }
    }

    private fun encode(value: String) = URLEncoder.encode(value, "UTF-8").replace("+", "%20")
    private fun JSONArray?.objects(): List<JSONObject> = this?.let { array -> (0 until array.length()).mapNotNull { array.optJSONObject(it) } }.orEmpty()
    private fun JSONObject.optNullable(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }
    private fun JSONObject.url(key: String): String? = optNullable(key)?.let { if (it.startsWith("/")) PUBLIC_API_ORIGIN + it else it }
    private fun JSONObject.intOrNull(key: String): Int? = if (!has(key) || isNull(key)) null else optInt(key)
}
