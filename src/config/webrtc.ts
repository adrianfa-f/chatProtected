// src/config/webrtc.ts
export const RTC_CONFIGURATION: RTCConfiguration = {
    iceServers: [{
        urls: ["stun:ws-turn3.xirsys.com"]
    }, {
        username: import.meta.env.VITE_TURN_USER,
        credential: import.meta.env.VITE_TURN_PASS,
        urls: [
            "turn:ws-turn3.xirsys.com:80?transport=udp",
            "turn:ws-turn3.xirsys.com:3478?transport=udp",
            "turn:ws-turn3.xirsys.com:80?transport=tcp",
            "turn:ws-turn3.xirsys.com:3478?transport=tcp",
            "turns:ws-turn3.xirsys.com:443?transport=tcp",
            "turns:ws-turn3.xirsys.com:5349?transport=tcp"
        ]
    }]
};
