package com.example.drivestream.ui.explorer

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import okhttp3.*

@Serializable
data class DriveItem(
    val id: String,
    val name: String,
    val mimeType: String,
    val size: String? = null,
    val thumbnailLink: String? = null,
    val iconLink: String? = null
)

@Serializable
data class FilesResponse(
    val files: List<DriveItem>
)

@Serializable
data class PlaybackProgressItem(
    val fileId: String,
    val name: String,
    val currentTime: Double,
    val duration: Double,
    val updatedAt: Long
)

@Serializable
data class WatchHistoryItem(
    val fileId: String,
    val name: String,
    val timestamp: Long
)

@Serializable
data class DashboardResponse(
    val continueWatching: List<PlaybackProgressItem>,
    val history: List<WatchHistoryItem>
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExplorerScreen(
    folderId: String,
    folderName: String,
    onFolderClick: (String, String) -> Unit,
    onVideoClick: (String, String, String?, Boolean) -> Unit,
    onDisconnect: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    // Retrieve configuration
    val prefs = remember { context.getSharedPreferences("drivestream_prefs", Context.MODE_PRIVATE) }
    val serverUrl = remember { prefs.getString("server_url", "") ?: "" }
    val sessionToken = remember { prefs.getString("session_token", "") ?: "" }
    val username = remember { prefs.getString("username", "") ?: "User" }

    var itemsList by remember { mutableStateOf<List<DriveItem>>(emptyList()) }
    var continueWatchingList by remember { mutableStateOf<List<PlaybackProgressItem>>(emptyList()) }
    var historyList by remember { mutableStateOf<List<WatchHistoryItem>>(emptyList()) }
    
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    
    // Search fields
    var searchQuery by remember { mutableStateOf("") }
    var isSearchMode by remember { mutableStateOf(false) }

    // Google Drive connection status
    var isGoogleConnected by remember { mutableStateOf(true) }

    // Watch Party State
    var activeRoomId by remember { mutableStateOf("") }
    var activeRoomMembers by remember { mutableStateOf("") }
    var explorerWebSocket by remember { mutableStateOf<WebSocket?>(null) }

    // Helper: Connect to Watch Party Room
    val connectToWatchParty: (String) -> Unit = { rId ->
        explorerWebSocket?.close(1000, "Reconnecting")
        explorerWebSocket = null

        val cleanHost = serverUrl.replace("http://", "").replace("https://", "")
        val wsProtocol = if (serverUrl.startsWith("https")) "wss" else "ws"
        val wsUrl = "$wsProtocol://$cleanHost/?sessionToken=${java.net.URLEncoder.encode(sessionToken, "UTF-8")}&roomId=$rId"

        val client = OkHttpClient()
        val request = Request.Builder().url(wsUrl).build()
        val listener = object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                scope.launch(Dispatchers.Main) {
                    activeRoomId = rId
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val json = Json { ignoreUnknownKeys = true }
                    val element = json.parseToJsonElement(text)
                    val type = element.jsonObject["type"]?.jsonPrimitive?.content
                    
                    if (type == "participants") {
                        val members = element.jsonObject["list"]?.jsonArray?.map { it.jsonPrimitive.content }?.joinToString(", ") ?: ""
                        scope.launch(Dispatchers.Main) {
                            activeRoomMembers = members
                        }
                    } else if (type == "sync") {
                        val action = element.jsonObject["action"]?.jsonPrimitive?.content
                        if (action == "load") {
                            val fId = element.jsonObject["fileId"]?.jsonPrimitive?.content ?: ""
                            val fName = element.jsonObject["name"]?.jsonPrimitive?.content ?: ""
                            if (fId.isNotEmpty() && fName.isNotEmpty()) {
                                scope.launch(Dispatchers.Main) {
                                    onVideoClick(fId, fName, rId, false)
                                }
                            }
                        } else if (action == "load_youtube") {
                            val ytId = element.jsonObject["youtubeId"]?.jsonPrimitive?.content ?: ""
                            val fName = element.jsonObject["name"]?.jsonPrimitive?.content ?: "YouTube Video"
                            if (ytId.isNotEmpty()) {
                                scope.launch(Dispatchers.Main) {
                                    onVideoClick(ytId, fName, rId, true)
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                scope.launch(Dispatchers.Main) {
                    activeRoomId = ""
                    activeRoomMembers = ""
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                scope.launch(Dispatchers.Main) {
                    activeRoomId = ""
                    activeRoomMembers = ""
                }
            }
        }

        explorerWebSocket = client.newWebSocket(request, listener)
    }

    val disconnectWatchParty = {
        explorerWebSocket?.close(1000, "Leaving party")
        explorerWebSocket = null
        activeRoomId = ""
        activeRoomMembers = ""
    }

    // Function to reload files & dashboard
    val loadData: suspend (String) -> Unit = { id ->
        isLoading = true
        errorMessage = null
        try {
            if (isSearchMode && searchQuery.trim().isNotEmpty()) {
                itemsList = executeDriveSearch(serverUrl, sessionToken, searchQuery.trim())
                continueWatchingList = emptyList()
                historyList = emptyList()
                isGoogleConnected = true
            } else {
                try {
                    itemsList = fetchFiles(serverUrl, sessionToken, id)
                    isGoogleConnected = true
                } catch (e: Exception) {
                    if (id == "root") {
                        // Root query fails: Google Drive is not connected
                        isGoogleConnected = false
                        itemsList = emptyList()
                    } else {
                        throw e
                    }
                }

                if (id == "root" && isGoogleConnected) {
                    val dash = fetchDashboard(serverUrl, sessionToken)
                    continueWatchingList = dash.continueWatching
                    historyList = dash.history
                } else {
                    continueWatchingList = emptyList()
                    historyList = emptyList()
                }
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Failed to retrieve directory contents"
        } finally {
            isLoading = false
        }
    }

    // Fetch items on mount or folderId change
    LaunchedEffect(folderId, isSearchMode) {
        loadData(folderId)
    }

    // Disconnect socket on close/nav out
    DisposableEffect(Unit) {
        onDispose {
            explorerWebSocket?.close(1000, "Disposed ExplorerScreen")
            explorerWebSocket = null
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = if (isSearchMode) "Search results" else folderName,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                        Text(
                            text = "Logged in as $username",
                            color = Color(0xFFA1A1AA),
                            fontSize = 11.sp
                        )
                    }
                },
                actions = {
                    TextButton(onClick = onDisconnect) {
                        Text(
                            text = "Sign Out",
                            color = Color(0xFFEF4444),
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF0F0C20)
                )
            )
        },
        modifier = modifier
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color(0xFF0F0C20),
                            Color(0xFF09090B)
                        )
                    )
                )
        ) {
            // Search Input Row (only visible if Google is connected)
            if (isGoogleConnected) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { 
                        searchQuery = it 
                        if (it.isEmpty() && isSearchMode) {
                            isSearchMode = false
                        }
                    },
                    placeholder = { Text("Search videos across Google Drive...", color = Color.Gray, fontSize = 14.sp) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = {
                        if (searchQuery.trim().isNotEmpty()) {
                            isSearchMode = true
                        }
                    }),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = Color(0x22FFFFFF)
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { 
                                searchQuery = "" 
                                isSearchMode = false 
                            }) {
                                Text("✕", color = Color.Gray)
                            }
                        }
                    }
                )
            }

            Box(modifier = Modifier.fillMaxSize()) {
                if (isLoading) {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        CircularProgressIndicator()
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = if (isSearchMode) "Searching Drive..." else "Loading files...",
                            color = Color(0xFFA1A1AA)
                        )
                    }
                } else if (errorMessage != null) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = errorMessage!!,
                            color = Color(0xFFEF4444),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            modifier = Modifier.padding(bottom = 16.dp)
                        )
                        Button(onClick = {
                            scope.launch { loadData(folderId) }
                        }) {
                            Text("Retry")
                        }
                    }
                } else {
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 150.dp),
                        contentPadding = PaddingValues(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        // 0. Render Watch Party Join Card at root directory
                        if (folderId == "root" && !isSearchMode) {
                            item(span = { GridItemSpan(maxLineSpan) }) {
                                WatchPartyCard(
                                    roomId = activeRoomId,
                                    roomMembers = activeRoomMembers,
                                    onJoinRoom = { connectToWatchParty(it) },
                                    onLeaveRoom = { disconnectWatchParty() },
                                    onCreateRoom = {
                                        val code = (1..6).map { ('A'..'Z').random() }.joinToString("")
                                        connectToWatchParty(code)
                                    }
                                )
                            }
                        }

                        // Drive Connection Banner Notice (when not connected)
                        if (folderId == "root" && !isGoogleConnected && !isSearchMode) {
                            item(span = { GridItemSpan(maxLineSpan) }) {
                                Card(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(bottom = 16.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color(0x0DFFFFFF)),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x11FFFFFF))
                                ) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Text(
                                            text = "Google Drive Not Connected",
                                            color = Color.White,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp
                                        )
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = "Connect Google Drive on the Web dashboard to list and stream your own cloud files.",
                                            color = Color(0xFFA1A1AA),
                                            fontSize = 12.sp
                                        )
                                    }
                                }
                            }
                        }

                        // 1. Render Continue Watching row at root (using full-span header)
                        if (folderId == "root" && !isSearchMode && continueWatchingList.isNotEmpty()) {
                            item(span = { GridItemSpan(maxLineSpan) }) {
                                Column(modifier = Modifier.padding(bottom = 12.dp)) {
                                    Text(
                                        text = "Continue Watching",
                                        color = Color.White,
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(bottom = 8.dp)
                                    )
                                    LazyRow(
                                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                                        contentPadding = PaddingValues(end = 16.dp)
                                    ) {
                                        items(continueWatchingList) { progressItem ->
                                            ContinueWatchingCard(
                                                item = progressItem,
                                                onClick = { onVideoClick(progressItem.fileId, progressItem.name, activeRoomId.takeIf { it.isNotEmpty() }, false) }
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        // 2. Render Watch History row at root (using full-span header)
                        if (folderId == "root" && !isSearchMode && historyList.isNotEmpty()) {
                            item(span = { GridItemSpan(maxLineSpan) }) {
                                Column(modifier = Modifier.padding(bottom = 16.dp)) {
                                    Text(
                                        text = "Recently Watched",
                                        color = Color.White,
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(bottom = 8.dp)
                                    )
                                    LazyRow(
                                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                                        contentPadding = PaddingValues(end = 16.dp)
                                    ) {
                                        items(historyList) { historyItem ->
                                            HistoryCard(
                                                item = historyItem,
                                                onClick = { onVideoClick(historyItem.fileId, historyItem.name, activeRoomId.takeIf { it.isNotEmpty() }, false) }
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        // Grid label divider (only shown if Google Drive is connected)
                        if (isGoogleConnected && itemsList.isNotEmpty()) {
                            item(span = { GridItemSpan(maxLineSpan) }) {
                                Text(
                                    text = if (isSearchMode) "Search Results" else "Files & Folders",
                                    color = Color.White,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(vertical = 4.dp)
                                )
                            }
                        }

                        // 3. Render files list
                        items(itemsList) { item ->
                            FileGridItem(
                                item = item,
                                onClick = {
                                    if (item.mimeType == "application/vnd.google-apps.folder") {
                                        onFolderClick(item.id, item.name)
                                    } else {
                                        onVideoClick(item.id, item.name, activeRoomId.takeIf { it.isNotEmpty() }, false)
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun WatchPartyCard(
    roomId: String,
    roomMembers: String,
    onJoinRoom: (String) -> Unit,
    onLeaveRoom: () -> Unit,
    onCreateRoom: () -> Unit
) {
    var codeInput by remember { mutableStateOf("") }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 12.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0x1AFFFFFF))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("👥", fontSize = 20.sp)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Watch Party Room",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
            }
            
            Spacer(modifier = Modifier.height(12.dp))

            if (roomId.isEmpty()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Button(
                        onClick = onCreateRoom,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Text("Create Room")
                    }
                    
                    Text("or", color = Color.Gray, fontSize = 12.sp)

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = codeInput,
                            onValueChange = { codeInput = it.uppercase() },
                            placeholder = { Text("Code", color = Color.Gray, fontSize = 12.sp) },
                            singleLine = true,
                            modifier = Modifier.width(100.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = Color(0x22FFFFFF)
                            )
                        )
                        Button(
                            onClick = { 
                                if (codeInput.trim().isNotEmpty()) {
                                    onJoinRoom(codeInput.trim().uppercase())
                                    codeInput = ""
                                }
                            },
                            contentPadding = PaddingValues(horizontal = 12.dp)
                        ) {
                            Text("Join")
                        }
                    }
                }
            } else {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .background(Color(0xFF10B981), shape = androidx.compose.foundation.shape.CircleShape)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Connected to room: $roomId",
                                color = Color.White,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        
                        TextButton(
                            onClick = onLeaveRoom,
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Text("Leave Room", color = Color(0xFFEF4444), fontSize = 13.sp)
                        }
                    }
                    
                    if (roomMembers.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Participants: $roomMembers",
                            color = Color(0xFFA1A1AA),
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun FileGridItem(
    item: DriveItem,
    onClick: () -> Unit
) {
    val isFolder = item.mimeType == "application/vnd.google-apps.folder"
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = Color(0x22FFFFFF)
        ),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x11FFFFFF))
    ) {
        Column(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .background(
                        color = if (isFolder) Color(0x1A8B5CF6) else Color(0x1A3B82F6),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                if (isFolder) {
                    Text("📁", fontSize = 28.sp)
                } else {
                    Text("🎬", fontSize = 28.sp)
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Text(
                text = item.name,
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.heightIn(min = 36.dp)
            )

            if (!isFolder && item.size != null) {
                Text(
                    text = formatBytes(item.size.toLongOrNull() ?: 0L),
                    color = Color(0xFFA1A1AA),
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}

@Composable
fun ContinueWatchingCard(
    item: PlaybackProgressItem,
    onClick: () -> Unit
) {
    val progressPercent = remember(item.currentTime, item.duration) {
        if (item.duration > 0) (item.currentTime / item.duration).toFloat() else 0f
    }

    Card(
        modifier = Modifier
            .width(180.dp)
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = Color(0x1AFFFFFF))
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(80.dp)
                    .background(Color(0x0DFFFFFF), shape = MaterialTheme.shapes.small),
                contentAlignment = Alignment.Center
            ) {
                Text("🎬", fontSize = 28.sp)
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = item.name,
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            
            Spacer(modifier = Modifier.height(6.dp))
            
            LinearProgressIndicator(
                progress = { progressPercent },
                color = Color(0xFFEF4444),
                trackColor = Color(0x33FFFFFF),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
            )
        }
    }
}

@Composable
fun HistoryCard(
    item: WatchHistoryItem,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .width(150.dp)
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = Color(0x1AFFFFFF))
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
                    .background(Color(0x0DFFFFFF), shape = MaterialTheme.shapes.small),
                contentAlignment = Alignment.Center
            ) {
                Text("▶️", fontSize = 22.sp)
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = item.name,
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

private suspend fun fetchFiles(
    serverUrl: String,
    sessionToken: String,
    parentId: String
): List<DriveItem> = withContext(Dispatchers.IO) {
    val client = OkHttpClient()
    val url = "$serverUrl/api/files?parentId=$parentId"
    
    val request = Request.Builder()
        .url(url)
        .header("Authorization", "Bearer $sessionToken")
        .build()

    client.newCall(request).execute().use { response ->
        if (response.code == 401) {
            throw Exception("Session Expired: Please Sign Out and Sign In again.")
        }
        if (!response.isSuccessful) {
            throw Exception("HTTP Error: ${response.code}")
        }
        val responseBody = response.body?.string() ?: throw Exception("Empty response")
        val json = Json { ignoreUnknownKeys = true }
        val parsed = json.decodeFromString<FilesResponse>(responseBody)
        parsed.files
    }
}

// Fetch dashboard items
private suspend fun fetchDashboard(
    serverUrl: String,
    sessionToken: String
): DashboardResponse = withContext(Dispatchers.IO) {
    val client = OkHttpClient()
    val url = "$serverUrl/api/dashboard"
    val request = Request.Builder()
        .url(url)
        .header("Authorization", "Bearer $sessionToken")
        .build()

    client.newCall(request).execute().use { response ->
        if (!response.isSuccessful) throw Exception("HTTP ${response.code}")
        val body = response.body?.string() ?: throw Exception("Empty dashboard response")
        val json = Json { ignoreUnknownKeys = true }
        json.decodeFromString<DashboardResponse>(body)
    }
}

// Execute Google Drive search query
private suspend fun executeDriveSearch(
    serverUrl: String,
    sessionToken: String,
    query: String
): List<DriveItem> = withContext(Dispatchers.IO) {
    val client = OkHttpClient()
    val url = "$serverUrl/api/search?query=${java.net.URLEncoder.encode(query, "UTF-8")}"
    val request = Request.Builder()
        .url(url)
        .header("Authorization", "Bearer $sessionToken")
        .build()

    client.newCall(request).execute().use { response ->
        if (!response.isSuccessful) throw Exception("HTTP ${response.code}")
        val body = response.body?.string() ?: throw Exception("Empty search response")
        val json = Json { ignoreUnknownKeys = true }
        json.decodeFromString<FilesResponse>(body).files
    }
}

private fun formatBytes(bytes: Long): String {
    if (bytes <= 0) return "0 B"
    val units = arrayOf("B", "KB", "MB", "GB", "TB")
    val digitGroups = (Math.log10(bytes.toDouble()) / Math.log10(1024.0)).toInt()
    return String.format("%.2f %s", bytes / Math.pow(1024.0, digitGroups.toDouble()), units[digitGroups])
}
