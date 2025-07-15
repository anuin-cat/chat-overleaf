import { Provider } from "react-redux"
import { PersistGate } from "@plasmohq/redux-persist/integration/react"
import { LoginForm } from "@/components/login-form"
import { store, persistor } from "~store"

import "globals.css"

const IndexPopup = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={<div>加载中...</div>} persistor={persistor}>
        <div className="flex h-[25rem] w-[25rem] flex-col">
          <LoginForm />
        </div>
      </PersistGate>
    </Provider>
  )
}

export default IndexPopup
