import { combineReducers } from "@reduxjs/toolkit"
import authSlice from "./auth.slice"
import appSlice from "./app.slice"
import uiSlice from "./ui.slice"
import settingsSlice from "./settings.slice"

const rootReducer = combineReducers({
  auth: authSlice,
  app: appSlice,
  ui: uiSlice,
  settings: settingsSlice
})

export default rootReducer
export type RootState = ReturnType<typeof rootReducer>
