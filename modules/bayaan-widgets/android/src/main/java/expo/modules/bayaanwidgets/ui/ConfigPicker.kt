// main/java/expo/modules/bayaanwidgets/ui/ConfigPicker.kt
package expo.modules.bayaanwidgets.ui

import android.app.Activity
import android.app.AlertDialog

/** Plain dialogs for the widget configuration activities. */
object ConfigPicker {
  private const val THEME = android.R.style.Theme_DeviceDefault_Dialog_Alert

  /** A list of settings rows with a Done button. */
  fun menu(activity: Activity, title: String, rows: List<String>, onPick: (Int) -> Unit, onDone: () -> Unit, onCancel: () -> Unit) {
    AlertDialog.Builder(activity, THEME)
      .setTitle(title)
      .setItems(rows.toTypedArray()) { _, which -> onPick(which) }
      .setPositiveButton("Done") { _, _ -> onDone() }
      .setOnCancelListener { onCancel() }
      .show()
  }

  fun pick(activity: Activity, title: String, items: List<String>, onPick: (Int) -> Unit, onCancel: () -> Unit) {
    AlertDialog.Builder(activity, THEME)
      .setTitle(title)
      .setItems(items.toTypedArray()) { _, which -> onPick(which) }
      .setOnCancelListener { onCancel() }
      .show()
  }
}
