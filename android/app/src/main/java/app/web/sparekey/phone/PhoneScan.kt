package app.web.sparekey.phone

import android.Manifest
import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * What on this phone could let someone else watch it, read with public Android APIs only. It never changes a setting,
 * never opens another app and never sends anything: the result stays on the phone and goes to the shared rules
 * (assets/engine.js), which turn it into findings. Only finding codes can ever leave the phone, and only for the plan.
 *
 * For each installed app it reads: whether it is an enabled accessibility service (can read and control the screen),
 * an active device admin (can lock the phone and is hard to remove), a notification listener (can read notifications,
 * including messages and sign-in codes), allowed location all the time, or allowed usage access (can see which apps
 * are used); whether it came from the Play Store; and whether it is part of the phone's own system. For the phone:
 * whether USB debugging is on (a computer can control it) and whether apps may be installed from outside the store.
 */
object PhoneScan {
    data class Result(val facts: JSONObject, val notRead: List<String>)

    fun read(context: Context): Result {
        val pm = context.packageManager
        val notRead = ArrayList<String>()

        val accessibility = HashSet<String>()
        try {
            val am = context.getSystemService(AccessibilityManager::class.java)
            for (s in am.getEnabledAccessibilityServiceList(android.accessibilityservice.AccessibilityServiceInfo.FEEDBACK_ALL_MASK)) {
                s.resolveInfo?.serviceInfo?.packageName?.let { accessibility += it }
            }
            // The setting itself also lists services that are switched on but not running right now.
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
                ?.split(':')?.mapNotNull { it.substringBefore('/').takeIf { p -> p.isNotBlank() } }?.let { accessibility += it }
        } catch (e: Throwable) { notRead += "phone.accessibility" }

        val admins = HashSet<String>()
        try {
            val dpm = context.getSystemService(DevicePolicyManager::class.java)
            dpm.activeAdmins?.forEach { admins += it.packageName }
        } catch (e: Throwable) { notRead += "phone.device_admin" }

        val listeners = try { NotificationManagerCompat.getEnabledListenerPackages(context) } catch (e: Throwable) { notRead += "phone.notifications"; emptySet() }

        val appOps = context.getSystemService(AppOpsManager::class.java)
        val apps = JSONArray()
        val installed: List<PackageInfo> = try {
            if (Build.VERSION.SDK_INT >= 33) pm.getInstalledPackages(PackageManager.PackageInfoFlags.of(PackageManager.GET_PERMISSIONS.toLong()))
            else @Suppress("DEPRECATION") pm.getInstalledPackages(PackageManager.GET_PERMISSIONS)
        } catch (e: Throwable) { notRead += "phone.apps"; emptyList() }

        for (p in installed) {
            val app = p.applicationInfo ?: continue
            val pkg = p.packageName
            if (pkg == context.packageName) continue
            val system = (app.flags and (ApplicationInfo.FLAG_SYSTEM or ApplicationInfo.FLAG_UPDATED_SYSTEM_APP)) != 0
            val locationAlways = Build.VERSION.SDK_INT >= 29 &&
                pm.checkPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION, pkg) == PackageManager.PERMISSION_GRANTED
            val usage = try {
                @Suppress("DEPRECATION")
                appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, app.uid, pkg) == AppOpsManager.MODE_ALLOWED
            } catch (e: Throwable) { false }
            val messages = pm.checkPermission(Manifest.permission.READ_SMS, pkg) == PackageManager.PERMISSION_GRANTED ||
                pm.checkPermission(Manifest.permission.READ_CALL_LOG, pkg) == PackageManager.PERMISSION_GRANTED
            val powers = JSONObject()
                .put("accessibility", pkg in accessibility)
                .put("device_admin", pkg in admins)
                .put("notifications", pkg in listeners)
                .put("messages", messages)
                .put("location_always", locationAlways)
                .put("usage_access", usage)
            if ((0 until powers.length()).none { powers.getBoolean(powers.names()!!.getString(it)) }) continue
            val installer = try {
                if (Build.VERSION.SDK_INT >= 30) pm.getInstallSourceInfo(pkg).installingPackageName
                else @Suppress("DEPRECATION") pm.getInstallerPackageName(pkg)
            } catch (e: Throwable) { null }
            apps.put(JSONObject()
                .put("pkg", pkg)
                .put("label", pm.getApplicationLabel(app).toString().take(80))
                .put("system", system)
                .put("installer", when (installer) {
                    "com.android.vending" -> "play"
                    null -> "unknown"
                    else -> "other"
                })
                .put("first_installed", p.firstInstallTime)
                .put("powers", powers))
        }

        val device = JSONObject()
        // From Android 17 (API 37) these always read 0 for an app like this one, whatever the real setting is
        // (Settings.Global reference: "This will always return 0 for all third-party apps"). There, the setting is
        // listed as not checked, with how to look at it, rather than shown as off.
        if (Build.VERSION.SDK_INT >= 37) notRead += "phone.settings"
        else try { device.put("usb_debugging", Settings.Global.getInt(context.contentResolver, Settings.Global.ADB_ENABLED, 0) == 1) } catch (e: Throwable) { notRead += "phone.settings" }
        device.put("android", Build.VERSION.RELEASE).put("sdk", Build.VERSION.SDK_INT)

        return Result(JSONObject().put("apps", apps).put("device", device), notRead)
    }
}
