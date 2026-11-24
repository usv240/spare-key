package com.example.planted

import android.accessibilityservice.AccessibilityService
import android.app.admin.DeviceAdminReceiver
import android.service.notification.NotificationListenerService
import android.view.accessibility.AccessibilityEvent

// Each one does nothing. Only holding the access matters to the test.
class Watch : AccessibilityService() {
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}
}
class Listen : NotificationListenerService()
class Admin : DeviceAdminReceiver()

/** The test's cleanup: an admin app can give up its own admin access, so the test can then uninstall it. */
class Release : android.content.BroadcastReceiver() {
    override fun onReceive(context: android.content.Context, intent: android.content.Intent) {
        val dpm = context.getSystemService(android.app.admin.DevicePolicyManager::class.java)
        dpm.removeActiveAdmin(android.content.ComponentName(context, Admin::class.java))
    }
}
