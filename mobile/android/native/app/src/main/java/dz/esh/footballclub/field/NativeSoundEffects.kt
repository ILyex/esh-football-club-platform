package dz.esh.footballclub.field

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.SoundPool

/** Small, locally bundled UI cues. Playback uses sonification audio attributes and follows device volume. */
internal object NativeSoundEffects {
    private const val MAX_STREAMS = 2
    private var pool: SoundPool? = null
    private val samples = mutableMapOf<Int, Int>()
    private val loaded = mutableSetOf<Int>()
    private val queued = mutableListOf<Int>()

    @Synchronized
    fun initialize(context: Context) {
        if (pool != null) return
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val soundPool = SoundPool.Builder()
            .setMaxStreams(MAX_STREAMS)
            .setAudioAttributes(audioAttributes)
            .build()
        pool = soundPool
        soundPool.setOnLoadCompleteListener { _, sampleId, status ->
            synchronized(this) {
                if (status != 0) return@synchronized
                loaded += sampleId
                val waiting = queued.filter { samples[it] == sampleId }
                queued.removeAll(waiting.toSet())
                if (waiting.isNotEmpty()) playLoaded(sampleId)
            }
        }
        listOf(
            R.raw.sound_success_chime,
            R.raw.sound_goal_winner,
            R.raw.sound_notification_pop
        ).forEach { resource -> samples[resource] = soundPool.load(context.applicationContext, resource, 1) }
    }

    @Synchronized
    fun play(context: Context, resource: Int, enabled: Boolean = true) {
        if (!enabled) return
        val audioManager = context.getSystemService(AudioManager::class.java)
        if (audioManager.ringerMode != AudioManager.RINGER_MODE_NORMAL) return
        initialize(context)
        val soundPool = pool ?: return
        val sampleId = samples[resource] ?: return
        if (sampleId in loaded) playLoaded(sampleId) else if (resource !in queued) queued += resource
    }

    private fun playLoaded(sampleId: Int) {
        pool?.play(sampleId, 0.58f, 0.58f, 1, 0, 1f)
    }
}
