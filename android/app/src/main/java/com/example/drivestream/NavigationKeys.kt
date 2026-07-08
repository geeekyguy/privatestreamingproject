package com.example.drivestream

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

@Serializable
data object Setup : NavKey

@Serializable
data class Explorer(val folderId: String = "root", val folderName: String = "My Drive") : NavKey

@Serializable
data class Player(val fileId: String, val fileName: String, val roomId: String? = null, val isYouTube: Boolean = false) : NavKey
