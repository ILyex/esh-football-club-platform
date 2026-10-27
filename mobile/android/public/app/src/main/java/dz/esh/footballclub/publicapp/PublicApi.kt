package dz.esh.footballclub.publicapp

import android.content.Context
import androidx.core.text.HtmlCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

private const val PUBLIC_API_ORIGIN = "https://esh-platform-vercel-preview.vercel.app"

data class PublicClub(val name: String, val shortName: String, val logo: String?, val hero: String?, val description: String?, val stadium: String?)
data class PublicTeam(val id: String, val category: String, val name: String, val description: String?, val birthYearFrom: Int?, val birthYearTo: Int?, val playerCount: Int)
data class PublicStanding(val id: String, val rank: Int, val teamName: String, val teamLogo: String?, val isOurClub: Boolean, val played: Int, val won: Int, val drawn: Int, val lost: Int, val goalsFor: Int, val goalsAgainst: Int, val goalDifference: Int, val points: Int)
data class PublicCupTeam(val name: String, val logo: String?, val score: Int?, val isOurClub: Boolean)
data class PublicCupMatch(val id: String, val round: String, val home: PublicCupTeam, val away: PublicCupTeam, val status: String, val date: String?, val notes: String?)
data class PublicCupRound(val key: String, val label: String, val matches: List<PublicCupMatch>)
data class PublicCompetition(
    val id: String,
    val name: String,
    val organization: String?,
    val season: String,
    val category: String,
    val standings: List<PublicStanding>,
    val type: String = "LEAGUE",
    val seasonId: String = "",
    val isCurrentSeason: Boolean = false,
    val logo: String? = null,
    val status: String = "UPCOMING",
    val bracket: List<PublicCupRound> = emptyList()
)
data class PublicMatch(val id: String, val home: String, val away: String, val date: String, val status: String, val homeScore: Int?, val awayScore: Int?, val competition: String, val category: String?, val stadium: String?, val opponentLogo: String?, val isHomeFixture: Boolean = false)
data class PublicTraining(val id: String, val date: String, val start: String, val end: String, val location: String?, val category: String, val team: String)
data class PublicNews(val id: String, val slug: String, val title: String, val excerpt: String, val image: String?, val category: String?, val date: String)
data class PublicAnnouncement(val id: String, val title: String, val content: String, val priority: String)
data class PublicPhoto(val id: String, val url: String, val caption: String?)
data class PublicAlbum(val id: String, val name: String, val description: String?, val cover: String?, val count: Int, val category: String, val photos: List<PublicPhoto>)
data class PublicReel(val id: String, val title: String, val url: String, val platform: String)
data class PublicSnapshot(val club: PublicClub, val nextMatch: PublicMatch?, val matches: List<PublicMatch>, val results: List<PublicMatch>, val trainings: List<PublicTraining>, val news: List<PublicNews>, val announcements: List<PublicAnnouncement>, val albums: List<PublicAlbum>, val reels: List<PublicReel>, val teams: List<PublicTeam>, val competitions: List<PublicCompetition>)
data class PublicAlert(val id: String, val title: String, val body: String, val time: Long, val kind: String)
data class PublicMatchEvent(val id: String, val minute: Int, val type: String, val side: String, val player: String)
data class PublicMatchPlayer(val id: String, val name: String, val number: Int?, val position: String?, val photo: String?, val captain: Boolean)
data class PublicMatchCenter(val match: PublicMatch, val events: List<PublicMatchEvent>, val starting: List<PublicMatchPlayer>, val substitutes: List<PublicMatchPlayer>)
data class PublicArticle(val title: String, val content: String, val image: String?, val category: String?, val date: String)

object PublicApi {
    private const val CACHE_PREFS = "esh_public_content_cache"
    private const val CACHE_SCHEMA = "v3"

    fun fetch(context: Context, locale: String): PublicSnapshot {
        val response = request("/api/public/mobile?locale=$locale")
        // Keep the last good public feed on-device. If a later launch has no
        // connection, supporters still get the latest saved fixtures/news.
        context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE)
            .edit().putString("snapshot_${CACHE_SCHEMA}_$locale", response).apply()
        return parse(response)
    }

    fun cachedSnapshot(context: Context, locale: String): PublicSnapshot? = runCatching {
        context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE)
            .getString("snapshot_${CACHE_SCHEMA}_$locale", null)?.let(::parse)
    }.getOrNull()

    fun teams(locale: String): List<PublicTeam> = JSONObject(request("/api/public/mobile/teams?locale=$locale&t=${System.currentTimeMillis()}"))
        .optJSONArray("teams").objects().map { item ->
            PublicTeam(item.optString("id"), item.optString("category"), item.optString("name"), item.optNullable("description"), item.intOrNull("birthYearFrom"), item.intOrNull("birthYearTo"), item.optInt("playerCount"))
        }

    fun competitions(locale: String): List<PublicCompetition> = JSONObject(request("/api/public/mobile/competitions?locale=$locale&t=${System.currentTimeMillis()}"))
        .optJSONArray("competitions").objects().map(::competition)

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
            competitions = json.optJSONArray("competitions").objects().map(::competition)
        )
    }

    private fun competition(item: JSONObject) = PublicCompetition(
        id = item.optString("id"),
        name = item.optString("name"),
        organization = item.optNullable("organization"),
        season = item.optString("seasonLabel"),
        category = item.optString("category"),
        standings = item.optJSONArray("standings").objects().map { row -> PublicStanding(
            row.optString("id"), row.optInt("rank"), row.optString("teamName"), row.url("teamLogo"), row.optBoolean("isOurClub"),
            row.optInt("played"), row.optInt("won"), row.optInt("drawn"), row.optInt("lost"), row.optInt("goalsFor"),
            row.optInt("goalsAgainst"), row.optInt("goalDifference"), row.optInt("points")
        ) },
        type = item.optString("type", "LEAGUE"),
        seasonId = item.optString("seasonId"),
        isCurrentSeason = item.optBoolean("isCurrentSeason"),
        logo = item.url("logoUrl"),
        status = item.optString("status", "UPCOMING"),
        bracket = item.optJSONArray("bracket").objects().map { round -> PublicCupRound(
            round.optString("roundKey"), round.optString("label"), round.optJSONArray("matches").objects().map { match ->
                fun cupTeam(key: String): PublicCupTeam {
                    val team = match.optJSONObject(key) ?: JSONObject()
                    return PublicCupTeam(team.optString("name"), team.url("logo"), team.intOrNull("score"), team.optBoolean("isOurClub"))
                }
                PublicCupMatch(match.optString("id"), match.optString("round"), cupTeam("homeTeam"), cupTeam("awayTeam"), match.optString("status"), match.optNullable("date"), match.optNullable("notes"))
            }
        ) }
    )

    fun matchCenter(id: String, locale: String): PublicMatchCenter {
        val item = JSONObject(request("/api/public/mobile/matches/${encode(id)}?locale=$locale"))
        val match = match(item)
        val events = item.optJSONArray("events").objects().map { event ->
            val name = event.optString("playerNameFr").takeIf { locale == "fr" && it.isNotBlank() }
                ?: event.optString("playerName").takeIf { it.isNotBlank() && it != "—" }
                ?: if (locale == "fr") "Joueur" else "لاعب"
            PublicMatchEvent(event.optString("id"), event.optInt("minute"), event.optString("type"), event.optString("side"), name)
        }
        val localizedPlayer: (JSONObject) -> PublicMatchPlayer = { player ->
            val name = player.optString("playerNameFr").takeIf { locale == "fr" && it.isNotBlank() }
                ?: player.optString("playerName").takeIf { it.isNotBlank() }
                ?: if (locale == "fr") "Joueur" else "لاعب"
            PublicMatchPlayer(
                id = player.optString("playerId"),
                name = name,
                number = player.intOrNull("shirtNumber"),
                position = player.optNullable("position"),
                photo = player.url("photoUrl"),
                captain = player.optBoolean("isCaptain")
            )
        }
        val starting = item.optJSONArray("startingLineup").objects().map(localizedPlayer)
        val substitutes = item.optJSONArray("substitutes").objects().map(localizedPlayer)
        return PublicMatchCenter(match, events, starting, substitutes)
    }

    fun article(slug: String, locale: String): PublicArticle {
        val item = JSONObject(request("/api/public/mobile/news/${encode(slug)}?locale=$locale"))
        val plainContent = HtmlCompat.fromHtml(item.optString("content"), HtmlCompat.FROM_HTML_MODE_COMPACT)
            .toString()
            .replace(Regex("[ \\t]+"), " ")
            .replace(Regex("\\n{3,}"), "\\n\\n")
            .trim()
        return PublicArticle(item.optString("title"), plainContent, item.url("featuredImageUrl"), item.optNullable("category"), item.optString("publishedAt"))
    }

    fun album(id: String, locale: String): PublicAlbum {
        val item = JSONObject(request("/api/public/mobile/gallery/${encode(id)}?locale=$locale"))
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
