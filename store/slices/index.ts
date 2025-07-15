import { combineReducers } from "@reduxjs/toolkit"
import authSlice from "./auth.slice"
import appSlice from "./app.slice"
import uiSlice from "./ui.slice"

const rootReducer = combineReducers({
  auth: authSlice,
  app: appSlice,
  ui: uiSlice
})

export default rootReducer
export type RootState = ReturnType<typeof rootReducer>
