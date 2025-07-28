import { createContext, useContext, type ReactNode } from 'react'
import { useAudioCall } from '../hooks/useAudioCall'

type CallApi = ReturnType<typeof useAudioCall>

const CallContext = createContext<CallApi | null>(null)

export const CallProvider = ({ children }: { children: ReactNode }) => {
    const callApi = useAudioCall()
    return (
        <CallContext.Provider value={callApi}>
            {children}
        </CallContext.Provider>
    )
}

/* eslint-disable-next-line react-refresh/only-export-components */
export const useCall = (): CallApi => {
    const context = useContext(CallContext)
    if (!context) {
        throw new Error('useCall debe usarse dentro de <CallProvider>')
    }
    return context
}
