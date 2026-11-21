package com.example.escalafacil

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.*
import com.example.escalafacil.ui.navigation.*
import com.example.escalafacil.ui.theme.EscalaFacilTheme
import com.example.escalafacil.viewmodel.EscalaViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            EscalaFacilTheme {
                val navController = rememberNavController()
                val viewModel: EscalaViewModel = viewModel()
                val uiState by viewModel.uiState.collectAsState()

                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    bottomBar = {
                        NavigationBar {
                            val navBackStackEntry by navController.currentBackStackEntryAsState()
                            val currentDestination = navBackStackEntry?.destination

                            listOf(
                                BottomNavItem.Schedules,
                                BottomNavItem.Services,
                                BottomNavItem.Ministries,
                                BottomNavItem.Members,
                                BottomNavItem.Attendance
                            ).forEach { item ->
                                NavigationBarItem(
                                    icon = { /* Ícones Material 3 */ },
                                    label = { Text(item.label) },
                                    selected = currentDestination?.route == item.route::class.qualifiedName,
                                    onClick = {
                                        navController.navigate(item.route) {
                                            popUpTo(navController.graph.startDestinationId) { saveState = true }
                                            launchSingleTop = true
                                            restoreState = true
                                        }
                                    }
                                )
                            }
                        }
                    }
                ) { innerPadding ->
                    NavHost(
                        navController = navController,
                        startDestination = SchedulesRoute,
                        modifier = Modifier.padding(innerPadding)
                    ) {
                        composable<SchedulesRoute> {
                            // SchedulesScreen Composable
                        }
                        composable<ServicesRoute> {
                            // ServicesScreen Composable
                        }
                        composable<MinistriesRoute> {
                            // MinistriesScreen Composable
                        }
                        composable<MembersRoute> {
                            // MembersScreen Composable
                        }
                        composable<AttendanceRoute> {
                            // AttendanceScreen Composable
                        }
                    }
                }
            }
        }
    }
}
