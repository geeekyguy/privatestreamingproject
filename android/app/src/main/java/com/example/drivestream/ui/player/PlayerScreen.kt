package com.example.drivestream.ui.player

import android.content.Context
import android.net.Uri
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

@Serializable
data class ProgressResponse(
    val currentTime: Double,
    val duration: Double = 0.0
)

@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(
    fileId: String,
    fileName: String,
    roomId: String? = null,
    isYouTube: Boolean = false,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    // Retrieve configuration
    val prefs = remember { context.getSharedPreferences("drivestream_prefs", Context.MODE_PRIVATE) }
    val serverUrl = remember { prefs.getString("server_url", "") ?: "" }
    val sessionToken = remember { prefs.getString("session_token", "") ?: "" }

    if (isYouTube) {
        // ================= YOUTUBE EMBED PLAYER (WEBVIEW) =================
        val embedUrl = remember(serverUrl, fileId, roomId, sessionToken) {
            val cleanHost = serverUrl.replace("http://", "").replace("https://", "")
            val protocol = if (serverUrl.startsWith("https")) "https" else "http"
            val queryRoomId = roomId ?: ""
            "$protocol://$cleanHost/youtube-player-embed.html?videoId=${java.net.URLEncoder.encode(fileId, "UTF-8")}&roomId=${java.net.URLEncoder.encode(queryRoomId, "UTF-8")}&sessionToken=${java.net.URLEncoder.encode(sessionToken, "UTF-8")}"
        }

        Box(
            modifier = modifier.fillMaxSize().background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
            AndroidView(
                factory = { ctx ->
                    WebView(ctx).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.mediaPlaybackRequiresUserGesture = false
                        settings.useWideViewPort = true
                        settings.loadWithOverviewMode = true
                        
                        webViewClient = WebViewClient()
                        webChromeClient = WebChromeClient()
                        
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        loadUrl(embedUrl)
                    }
                },
                modifier = Modifier.fillMaxSize()
            )

            // Watch Party Joined Label at top-left
            if (!roomId.isNullOrEmpty()) {
                Row(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(16.dp)
                        .background(Color(0x80000000), shape = MaterialTheme.shapes.small)
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .background(Color(0xFF10B981), shape = androidx.compose.foundation.shape.CircleShape)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "YouTube Party Synced",
                        color = Color.White,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    } else {
        // ================= GOOGLE DRIVE STANDARD PLAYER (EXOPLAYER) =================
        val streamUrl = remember(serverUrl, fileId, sessionToken, roomId) {
            var url = "$serverUrl/api/stream/$fileId${if (sessionToken.isNotEmpty()) "?sessionToken=${java.net.URLEncoder.encode(sessionToken, "UTF-8")}" else ""}"
            if (!roomId.isNullOrEmpty()) {
                url += "&roomId=${java.net.URLEncoder.encode(roomId, "UTF-8")}"
            }
            url
        }

        var isPlayerReady by remember { mutableStateOf(false) }
        var errorMessage by remember { mutableStateOf<String?>(null) }
        
        var playbackSpeed by remember { mutableStateOf(1.0f) }

        // Watch Party State
        var playerWebSocket by remember { mutableStateOf<WebSocket?>(null) }
        var isRemoteEvent by remember { mutableStateOf(false) }

        // Initialize ExoPlayer
        val exoPlayer = remember {
            ExoPlayer.Builder(context).build().apply {
                playWhenReady = true
            }
        }

        val setSpeed: (Float) -> Unit = { speed ->
            exoPlayer.setPlaybackSpeed(speed)
            playbackSpeed = speed

            playerWebSocket?.let { ws ->
                scope.launch(Dispatchers.IO) {
                    try {
                        sendPartySyncMessage(ws, "speed", exoPlayer.currentPosition / 1000.0, speed.toDouble())
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        }

        val syncDatabaseProgress = remember(serverUrl, fileId, fileName, sessionToken, exoPlayer) {
            suspend {
                val currentPos = exoPlayer.currentPosition / 1000.0
                val totalDuration = exoPlayer.duration / 1000.0
                if (currentPos > 0 && totalDuration > 0) {
                    postPlaybackProgress(serverUrl, sessionToken, fileId, fileName, currentPos, totalDuration)
                }
            }
        }

        DisposableEffect(exoPlayer, playerWebSocket, isRemoteEvent) {
            val listener = object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    isPlayerReady = playbackState == Player.STATE_READY || playbackState == Player.STATE_BUFFERING
                }

                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    errorMessage = "Failed to stream video: ${error.message}"
                    error.printStackTrace()
                }

                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    if (isRemoteEvent) return
                    playerWebSocket?.let { ws ->
                        scope.launch(Dispatchers.IO) {
                            try {
                                val action = if (isPlaying) "play" else "pause"
                                sendPartySyncMessage(ws, action, exoPlayer.currentPosition / 1000.0, playbackSpeed.toDouble())
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                    }
                }

                override fun onPositionDiscontinuity(
                    oldPosition: Player.PositionInfo,
                    newPosition: Player.PositionInfo,
                    reason: Int
                ) {
                    if (isRemoteEvent) return
                    if (reason == Player.DISCONTINUITY_REASON_SEEK) {
                        playerWebSocket?.let { ws ->
                            scope.launch(Dispatchers.IO) {
                                try {
                                    sendPartySyncMessage(ws, "seek", newPosition.positionMs / 1000.0, playbackSpeed.toDouble())
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                }
                            }
                        }
                    }
                }
            }

            exoPlayer.addListener(listener)
            onDispose {
                exoPlayer.removeListener(listener)
            }
        }

        LaunchedEffect(roomId) {
            if (roomId.isNullOrEmpty()) return@LaunchedEffect

            val cleanHost = serverUrl.replace("http://", "").replace("https://", "")
            val wsProtocol = if (serverUrl.startsWith("https")) "wss" else "ws"
            val wsUrl = "$wsProtocol://$cleanHost/?sessionToken=${java.net.URLEncoder.encode(sessionToken, "UTF-8")}&roomId=$roomId"

            val client = OkHttpClient()
            val request = Request.Builder().url(wsUrl).build()
            val wsListener = object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    playerWebSocket = webSocket
                    scope.launch(Dispatchers.IO) {
                        try {
                            sendPartySyncMessage(webSocket, "load", 0.0, 1.0, fileId, fileName)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                }

                override fun onMessage(webSocket: WebSocket, text: String) {
                    try {
                        val json = Json { ignoreUnknownKeys = true }
                        val element = json.parseToJsonElement(text)
                        val type = element.jsonObject["type"]?.jsonPrimitive?.content
                        
                        if (type == "sync") {
                            val action = element.jsonObject["action"]?.jsonPrimitive?.content
                            val time = element.jsonObject["time"]?.jsonPrimitive?.doubleOrNull ?: 0.0
                            val speedVal = element.jsonObject["speed"]?.jsonPrimitive?.doubleOrNull ?: 1.0

                            scope.launch(Dispatchers.Main) {
                                isRemoteEvent = true
                                
                                when (action) {
                                    "play" -> {
                                        if (Math.abs((exoPlayer.currentPosition / 1000.0) - time) > 1.5) {
                                            exoPlayer.seekTo((time * 1000).toLong())
                                        }
                                        exoPlayer.play()
                                    }
                                    "pause" -> {
                                        exoPlayer.pause()
                                        exoPlayer.seekTo((time * 1000).toLong())
                                    }
                                    "seek" -> {
                                        exoPlayer.seekTo((time * 1000).toLong())
                                    }
                                    "speed" -> {
                                        exoPlayer.setPlaybackSpeed(speedVal.toFloat())
                                        playbackSpeed = speedVal.toFloat()
                                    }
                                }
                                
                                delay(300)
                                isRemoteEvent = false
                            }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                    playerWebSocket = null
                }

                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                    playerWebSocket = null
                }
            }

            val ws = client.newWebSocket(request, wsListener)
        }

        LaunchedEffect(streamUrl) {
            try {
                val startSecs = fetchStartingProgress(serverUrl, sessionToken, fileId)
                if (startSecs > 0) {
                    exoPlayer.seekTo((startSecs * 1000).toLong())
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }

            val mediaItem = MediaItem.fromUri(Uri.parse(streamUrl))
            exoPlayer.setMediaItem(mediaItem)
            exoPlayer.prepare()

            while (true) {
                delay(5000)
                try {
                    syncDatabaseProgress()
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }

        DisposableEffect(Unit) {
            onDispose {
                playerWebSocket?.close(1000, "Leaving PlayerScreen")
                playerWebSocket = null

                scope.launch(Dispatchers.IO) {
                    try {
                        val currentPos = exoPlayer.currentPosition / 1000.0
                        val totalDuration = exoPlayer.duration / 1000.0
                        if (currentPos > 0 && totalDuration > 0) {
                            postPlaybackProgress(serverUrl, sessionToken, fileId, fileName, currentPos, totalDuration)
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
                exoPlayer.release()
            }
        }

        Box(
            modifier = modifier.background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
            if (errorMessage != null) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = errorMessage!!,
                        color = Color(0xFFEF4444),
                        fontWeight = FontWeight.Medium,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Ensure the server is running and the video format is supported by Android.",
                        color = Color.Gray,
                        textAlign = TextAlign.Center
                    )
                }
            } else {
                AndroidView(
                    factory = { ctx ->
                        PlayerView(ctx).apply {
                            player = exoPlayer
                            useController = true
                            layoutParams = FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )

                Row(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(16.dp)
                        .background(Color(0x80000000), shape = MaterialTheme.shapes.small)
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Speed:", color = Color.Gray, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    listOf(0.5f, 1.0f, 1.25f, 1.5f, 2.0f).forEach { speed ->
                        Text(
                            text = if (speed == 1.0f) "Normal" else "${speed}x",
                            color = if (playbackSpeed == speed) MaterialTheme.colorScheme.primary else Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .clickable { setSpeed(speed) }
                                .padding(horizontal = 4.dp, vertical = 2.dp)
                        )
                    }
                }

                if (!roomId.isNullOrEmpty() && playerWebSocket != null) {
                    Row(
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(16.dp)
                            .background(Color(0x80000000), shape = MaterialTheme.shapes.small)
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .background(Color(0xFF10B981), shape = androidx.compose.foundation.shape.CircleShape)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Watch Party Synced",
                            color = Color.White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                if (!isPlayerReady && errorMessage == null) {
                    CircularProgressIndicator(
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
            }
        }
    }
}

// REST call to fetch starting progress coordinate
private suspend fun fetchStartingProgress(
    serverUrl: String,
    sessionToken: String,
    fileId: String
): Double = withContext(Dispatchers.IO) {
    val client = OkHttpClient()
    val url = "$serverUrl/api/progress/$fileId"
    val request = Request.Builder()
        .url(url)
        .header("Authorization", "Bearer $sessionToken")
        .build()

    client.newCall(request).execute().use { response ->
        if (!response.isSuccessful) return@withContext 0.0
        val body = response.body?.string() ?: return@withContext 0.0
        val json = Json { ignoreUnknownKeys = true }
        val parsed = json.decodeFromString<ProgressResponse>(body)
        parsed.currentTime
    }
}

// REST call to post progress sync updates
private suspend fun postPlaybackProgress(
    serverUrl: String,
    sessionToken: String,
    fileId: String,
    name: String,
    currentTime: Double,
    duration: Double
) = withContext(Dispatchers.IO) {
    val client = OkHttpClient()
    val url = "$serverUrl/api/progress"
    
    val mediaType = "application/json; charset=utf-8".toMediaType()
    
    // JSON Payload
    val escapedName = name.replace("\"", "\\\"")
    val jsonBody = """
        {
            "fileId": "$fileId",
            "name": "$escapedName",
            "currentTime": $currentTime,
            "duration": $duration
        }
    """.trimIndent()
    
    val requestBody = jsonBody.toRequestBody(mediaType)
    val request = Request.Builder()
        .url(url)
        .post(requestBody)
        .header("Authorization", "Bearer $sessionToken")
        .build()

    try {
        client.newCall(request).execute().close()
    } catch (e: Exception) {
        e.printStackTrace()
    }
}

// Send Watch Party message packet over WebSocket connection
private fun sendPartySyncMessage(
    ws: WebSocket,
    action: String,
    time: Double,
    speed: Double = 1.0,
    fileId: String? = null,
    name: String? = null
) {
    val syncObj = buildJsonObject {
        put("type", "sync")
        put("action", action)
        put("time", time)
        put("speed", speed)
        if (fileId != null) put("fileId", fileId)
        if (name != null) put("name", name)
    }
    ws.send(syncObj.toString())
}
