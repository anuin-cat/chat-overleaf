import { Provider } from "react-redux"
import { PersistGate } from "@plasmohq/redux-persist/integration/react"
import { UsageGuide } from "~components/usage-guide"
import { store, persistor } from "~store"

import "globals.css"

const IndexPopup = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={<div>加载中...</div>} persistor={persistor}>
        <div className="flex h-[32rem] w-[28rem] flex-col">
          <UsageGuide />
        </div>
      </PersistGate>
    </Provider>
  )
}

export default IndexPopup
