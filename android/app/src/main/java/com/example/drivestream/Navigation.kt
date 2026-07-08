package com.example.drivestream

import android.content.Context
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.example.drivestream.ui.explorer.ExplorerScreen
import com.example.drivestream.ui.player.PlayerScreen
import com.example.drivestream.ui.setup.SetupScreen

@Composable
fun MainNavigation() {
  val context = LocalContext.current
  
  // Decide whether to start in Setup or Explorer
  val startDestination = remember {
    val prefs = context.getSharedPreferences("drivestream_prefs", Context.MODE_PRIVATE)
    val serverUrl = prefs.getString("server_url", "")
    val sessionToken = prefs.getString("session_token", "")
    if (serverUrl.isNullOrEmpty() || sessionToken.isNullOrEmpty()) {
      Setup
    } else {
      Explorer("root", "My Drive")
    }
  }

  val backStack = rememberNavBackStack(startDestination)

  NavDisplay(
    backStack = backStack,
    onBack = { backStack.removeLastOrNull() },
    entryProvider =
      entryProvider {
        entry<Setup> {
          SetupScreen(
            onSetupComplete = {
              backStack.add(Explorer("root", "My Drive"))
            },
            modifier = Modifier.fillMaxSize()
          )
        }
        
        entry<Explorer> { key ->
          ExplorerScreen(
            folderId = key.folderId,
            folderName = key.folderName,
            onFolderClick = { folderId, name ->
              backStack.add(Explorer(folderId, name))
            },
            onVideoClick = { fileId, name, roomId, isYouTube ->
              backStack.add(Player(fileId, name, roomId, isYouTube))
            },
            onDisconnect = {
              // Disconnect: clear prefs and navigate to Setup
              val prefs = context.getSharedPreferences("drivestream_prefs", Context.MODE_PRIVATE)
              prefs.edit().clear().apply()
              
              // Pop elements off the stack
              while (backStack.isNotEmpty()) {
                backStack.removeLastOrNull()
              }
              backStack.add(Setup)
            },
            modifier = Modifier.fillMaxSize()
          )
        }
        
        entry<Player> { key ->
          PlayerScreen(
            fileId = key.fileId,
            fileName = key.fileName,
            roomId = key.roomId,
            isYouTube = key.isYouTube,
            modifier = Modifier.fillMaxSize()
          )
        }
      },
  )
}
