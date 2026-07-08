package com.example.drivestream.ui.setup

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

@Serializable
data class AuthResponse(
    val success: Boolean,
    val token: String,
    val username: String
)

@Serializable
data class ErrorResponse(
    val error: String
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SetupScreen(
    onSetupComplete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var serverUrl by remember { mutableStateOf("http://10.0.2.2:3000") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isRegisterMode by remember { mutableStateOf(false) }
    
    var isAuthenticating by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF0F0C20),
                        Color(0xFF09090B)
                    )
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color(0x991C1917)
            )
        ) {
            Column(
                modifier = Modifier
                    .padding(24.dp)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = if (isRegisterMode) "Create Account" else "Sign In",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )

                Text(
                    text = if (isRegisterMode) 
                        "Register a new profile on your family streaming server." 
                    else 
                        "Log in to connect and browse your private video library.",
                    fontSize = 13.sp,
                    color = Color(0xFFA1A1AA),
                    modifier = Modifier.padding(bottom = 6.dp)
                )

                OutlinedTextField(
                    value = serverUrl,
                    onValueChange = { serverUrl = it },
                    label = { Text("Server URL", color = Color(0xFFA1A1AA)) },
                    placeholder = { Text("http://192.168.1.100:3000") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Uri,
                        imeAction = ImeAction.Next
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = Color(0x33FFFFFF)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("Username", color = Color(0xFFA1A1AA)) },
                    placeholder = { Text("Enter username") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Text,
                        imeAction = ImeAction.Next
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = Color(0x33FFFFFF)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password", color = Color(0xFFA1A1AA)) },
                    placeholder = { Text("Enter password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = Color(0x33FFFFFF)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                if (errorMessage != null) {
                    Text(
                        text = errorMessage!!,
                        color = Color(0xFFEF4444),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.align(Alignment.Start)
                    )
                }

                Button(
                    onClick = {
                        val cleanUrl = serverUrl.trim().removeSuffix("/")
                        val userVal = username.trim()
                        val passVal = password

                        if (cleanUrl.isEmpty() || userVal.isEmpty() || passVal.isEmpty()) {
                            errorMessage = "All fields are required"
                            return@Button
                        }

                        isAuthenticating = true
                        errorMessage = null
                        
                        scope.launch {
                            try {
                                val response = performAuth(cleanUrl, userVal, passVal, isRegisterMode)
                                if (response != null) {
                                    // Save credentials to Preferences
                                    val prefs = context.getSharedPreferences("drivestream_prefs", Context.MODE_PRIVATE)
                                    prefs.edit()
                                        .putString("server_url", cleanUrl)
                                        .putString("session_token", response.token)
                                        .putString("username", response.username)
                                        .apply()

                                    onSetupComplete()
                                } else {
                                    errorMessage = "Connection to server failed. Verify URL is correct."
                                }
                            } catch (e: Exception) {
                                errorMessage = e.message ?: "Authentication failed."
                            } finally {
                                isAuthenticating = false
                            }
                        }
                    },
                    enabled = !isAuthenticating,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                ) {
                    if (isAuthenticating) {
                        CircularProgressIndicator(
                            color = Color.White,
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(
                            text = if (isRegisterMode) "Register" else "Sign In",
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Row(
                    modifier = Modifier.padding(top = 8.dp),
                    horizontalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = if (isRegisterMode) "Already have an account? " else "Don't have an account? ",
                        color = Color(0xFFA1A1AA),
                        fontSize = 13.sp
                    )
                    Text(
                        text = if (isRegisterMode) "Sign In" else "Sign Up",
                        color = MaterialTheme.colorScheme.primary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        textDecoration = TextDecoration.Underline,
                        modifier = Modifier.clickable {
                            isRegisterMode = !isRegisterMode
                            errorMessage = null
                        }
                    )
                }
            }
        }
    }
}

private suspend fun performAuth(
    url: String,
    user: String,
    pass: String,
    isRegister: Boolean
): AuthResponse? = withContext(Dispatchers.IO) {
    val client = OkHttpClient()
    val mediaType = "application/json; charset=utf-8".toMediaType()
    val jsonBody = "{\"username\":\"$user\",\"password\":\"$pass\"}"
    val requestBody = jsonBody.toRequestBody(mediaType)

    val endpoint = if (isRegister) "$url/api/register" else "$url/api/login"
    val request = Request.Builder()
        .url(endpoint)
        .post(requestBody)
        .build()

    try {
        client.newCall(request).execute().use { response ->
            val responseBody = response.body?.string() ?: throw Exception("Server returned empty response")
            val json = Json { ignoreUnknownKeys = true }
            
            if (response.isSuccessful) {
                json.decodeFromString<AuthResponse>(responseBody)
            } else {
                val errorMsg = try {
                    json.decodeFromString<ErrorResponse>(responseBody).error
                } catch (e: Exception) {
                    "Authentication error (${response.code})"
                }
                throw Exception(errorMsg)
            }
        }
    } catch (e: java.io.IOException) {
        null // Network connection error
    }
}
