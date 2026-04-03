import SwiftUI
import WebKit

private let appBaseURLString = "https://pokemon-damage-calc.vercel.app"

struct ContentView: View {
    @EnvironmentObject private var appLinkRouter: AppLinkRouter
    @StateObject private var webViewModel = WebViewModel()
    @State private var showSplash = true

    var body: some View {
        ZStack {
            WebView(viewModel: webViewModel)
                .ignoresSafeArea()

            // エラー表示
            if let error = webViewModel.error {
                VStack(spacing: 16) {
                    Text("読み込みエラー")
                        .font(.headline)
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.gray)
                        .multilineTextAlignment(.center)
                    Button("再読み込み") {
                        webViewModel.reload()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 0.898, green: 0.224, blue: 0.208))
                }
                .padding()
                .background(Color.white)
                .cornerRadius(12)
                .shadow(radius: 4)
            }

            // スプラッシュ画面
            if showSplash {
                SplashView()
                    .transition(.opacity)
                    .zIndex(1)
            }
        }
        .onChange(of: webViewModel.isLoading) { _, isLoading in
            if !isLoading {
                withAnimation(.easeOut(duration: 0.3)) {
                    showSplash = false
                }
            }
        }
        .onReceive(appLinkRouter.$pendingURL) { url in
            guard let url else { return }
            webViewModel.handleIncomingAuthURL(url)
            appLinkRouter.consume()
        }
    }
}

// バックアップ: いつでもここに戻せる元状態
struct BaselineSplashView: View {
    @State private var opened = false
    @State private var glowVisible = false
    @State private var glowExpanded = false
    @State private var showFireworks = false
    @State private var showBeams = false

    // 花火パーティクル定義
    private let fireworks: [(offset: CGSize, delay: Double, color: Color)] = [
        (CGSize(width: -100, height: -180), 0.0,  Color(red: 1.0, green: 0.84, blue: 0.0)),
        (CGSize(width:  120, height: -150), 0.08, Color(red: 1.0, green: 0.65, blue: 0.0)),
        (CGSize(width: -140, height:  -60), 0.15, Color(red: 0.85, green: 0.55, blue: 1.0)),
        (CGSize(width:  150, height:   40), 0.05, Color(red: 0.0, green: 0.9,  blue: 0.8)),
        (CGSize(width:  -50, height:  160), 0.12, Color(red: 1.0, green: 0.84, blue: 0.0)),
        (CGSize(width:   80, height:  170), 0.18, Color(red: 1.0, green: 0.4,  blue: 0.6)),
        (CGSize(width: -160, height:  120), 0.10, Color(red: 0.4, green: 0.8,  blue: 1.0)),
        (CGSize(width:  160, height: -100), 0.03, Color(red: 1.0, green: 0.92, blue: 0.5)),
    ]

    // スポットライト光線
    private let beams: [(angle: Double, length: CGFloat, color: Color)] = [
        (  0, 300, Color(red: 0.0, green: 0.9, blue: 0.7)),
        ( 45, 260, Color(red: 0.4, green: 0.8, blue: 1.0)),
        ( 90, 280, Color(red: 0.85, green: 0.55, blue: 1.0)),
        (135, 250, Color(red: 0.0, green: 0.9, blue: 0.7)),
        (180, 290, Color(red: 0.4, green: 0.8, blue: 1.0)),
        (225, 240, Color(red: 1.0, green: 0.84, blue: 0.0)),
        (270, 270, Color(red: 0.85, green: 0.55, blue: 1.0)),
        (315, 255, Color(red: 1.0, green: 0.84, blue: 0.0)),
    ]

    var body: some View {
        ZStack {
            // 背景: 深いダークネイビー → パープル
            RadialGradient(
                colors: [
                    Color(red: 0.08, green: 0.05, blue: 0.18),
                    Color(red: 0.04, green: 0.02, blue: 0.10),
                    Color.black,
                ],
                center: .center,
                startRadius: 50,
                endRadius: 500
            )
            .ignoresSafeArea()

            // 背景のネオン装飾（薄い環状の光）
            Circle()
                .stroke(
                    LinearGradient(
                        colors: [
                            Color(red: 0.0, green: 0.8, blue: 0.6).opacity(0.15),
                            Color(red: 0.5, green: 0.3, blue: 1.0).opacity(0.08),
                        ],
                        startPoint: .top, endPoint: .bottom
                    ),
                    lineWidth: 2
                )
                .frame(width: 320, height: 320)
                .opacity(showBeams ? 1 : 0)

            Circle()
                .stroke(
                    Color(red: 1.0, green: 0.84, blue: 0.0).opacity(0.06),
                    lineWidth: 1.5
                )
                .frame(width: 260, height: 260)
                .opacity(showBeams ? 1 : 0)

            // スポットライト光線
            ForEach(0..<beams.count, id: \.self) { i in
                let beam = beams[i]
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [beam.color.opacity(0.5), beam.color.opacity(0)],
                            startPoint: .bottom, endPoint: .top
                        )
                    )
                    .frame(width: 3, height: showBeams ? beam.length : 0)
                    .offset(y: showBeams ? -beam.length / 2 - 55 : -55)
                    .rotationEffect(.degrees(beam.angle))
                    .opacity(showBeams ? 0.7 : 0)
            }

            // 中央のゴールドグロー（ボール背後）
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color(red: 1.0, green: 0.84, blue: 0.0).opacity(glowVisible ? 0.6 : 0),
                            Color(red: 1.0, green: 0.65, blue: 0.0).opacity(glowVisible ? 0.2 : 0),
                            Color.clear,
                        ],
                        center: .center,
                        startRadius: 20,
                        endRadius: glowExpanded ? 160 : 40
                    )
                )
                .frame(width: 320, height: 320)

            // ゴージャスボール
            BaselineGorgeousBallMark(opened: opened)
                .frame(width: 120, height: 120)
                .shadow(color: Color(red: 1.0, green: 0.84, blue: 0.0).opacity(0.4), radius: 20, y: 0)
                .shadow(color: .black.opacity(0.3), radius: 30, y: 14)

            // 花火パーティクル
            ForEach(0..<fireworks.count, id: \.self) { i in
                let fw = fireworks[i]
                FireworkBurst(color: fw.color, visible: showFireworks)
                    .offset(fw.offset)
            }
        }
        .onAppear {
            // ボールが開く
            withAnimation(.spring(response: 0.7, dampingFraction: 0.78).delay(0.3)) {
                opened = true
            }
            // ゴールドグロー
            withAnimation(.easeOut(duration: 0.15).delay(0.6)) {
                glowVisible = true
            }
            withAnimation(.easeOut(duration: 0.5).delay(0.65)) {
                glowExpanded = true
            }
            // 光線（ボールが開いた後）
            withAnimation(.easeOut(duration: 0.6).delay(0.7)) {
                showBeams = true
            }
            // 花火（光線と同時〜少し後）
            withAnimation(.spring(response: 0.8, dampingFraction: 0.6).delay(0.75)) {
                showFireworks = true
            }
        }
    }
}

// バックアップ: 完全に閉じたままの固定表示
struct ClosedOnlySplashView: View {
    private let opened = false
    private let showFireworks = false
    private let showBeams = false

    private let fireworks: [(offset: CGSize, delay: Double, color: Color)] = [
        (CGSize(width: -100, height: -180), 0.0,  Color(red: 1.0, green: 0.84, blue: 0.0)),
        (CGSize(width:  120, height: -150), 0.08, Color(red: 1.0, green: 0.65, blue: 0.0)),
        (CGSize(width: -140, height:  -60), 0.15, Color(red: 0.85, green: 0.55, blue: 1.0)),
        (CGSize(width:  150, height:   40), 0.05, Color(red: 0.0, green: 0.9,  blue: 0.8)),
        (CGSize(width:  -50, height:  160), 0.12, Color(red: 1.0, green: 0.84, blue: 0.0)),
        (CGSize(width:   80, height:  170), 0.18, Color(red: 1.0, green: 0.4,  blue: 0.6)),
        (CGSize(width: -160, height:  120), 0.10, Color(red: 0.4, green: 0.8,  blue: 1.0)),
        (CGSize(width:  160, height: -100), 0.03, Color(red: 1.0, green: 0.92, blue: 0.5)),
    ]

    private let beams: [(angle: Double, length: CGFloat, color: Color)] = [
        (  0, 300, Color(red: 0.0, green: 0.9, blue: 0.7)),
        ( 45, 260, Color(red: 0.4, green: 0.8, blue: 1.0)),
        ( 90, 280, Color(red: 0.85, green: 0.55, blue: 1.0)),
        (135, 250, Color(red: 0.0, green: 0.9, blue: 0.7)),
        (180, 290, Color(red: 0.4, green: 0.8, blue: 1.0)),
        (225, 240, Color(red: 1.0, green: 0.84, blue: 0.0)),
        (270, 270, Color(red: 0.85, green: 0.55, blue: 1.0)),
        (315, 255, Color(red: 1.0, green: 0.84, blue: 0.0)),
    ]

    var body: some View {
        splashBody(ballRotation: .degrees(0), opened: opened, showFireworks: showFireworks, showBeams: showBeams, glowRadius: 96, fireworks: fireworks, beams: beams)
    }
}

// スプラッシュ画面 — 閉じたまま左右にカタ、カタ
struct SplashView: View {
    @State private var ballRotation: Double = 0
    private let opened = false
    private let showFireworks = false
    private let showBeams = false

    private let fireworks: [(offset: CGSize, delay: Double, color: Color)] = [
        (CGSize(width: -100, height: -180), 0.0,  Color(red: 1.0, green: 0.84, blue: 0.0)),
        (CGSize(width:  120, height: -150), 0.08, Color(red: 1.0, green: 0.65, blue: 0.0)),
        (CGSize(width: -140, height:  -60), 0.15, Color(red: 0.85, green: 0.55, blue: 1.0)),
        (CGSize(width:  150, height:   40), 0.05, Color(red: 0.0, green: 0.9,  blue: 0.8)),
        (CGSize(width:  -50, height:  160), 0.12, Color(red: 1.0, green: 0.84, blue: 0.0)),
        (CGSize(width:   80, height:  170), 0.18, Color(red: 1.0, green: 0.4,  blue: 0.6)),
        (CGSize(width: -160, height:  120), 0.10, Color(red: 0.4, green: 0.8,  blue: 1.0)),
        (CGSize(width:  160, height: -100), 0.03, Color(red: 1.0, green: 0.92, blue: 0.5)),
    ]

    private let beams: [(angle: Double, length: CGFloat, color: Color)] = [
        (  0, 300, Color(red: 0.0, green: 0.9, blue: 0.7)),
        ( 45, 260, Color(red: 0.4, green: 0.8, blue: 1.0)),
        ( 90, 280, Color(red: 0.85, green: 0.55, blue: 1.0)),
        (135, 250, Color(red: 0.0, green: 0.9, blue: 0.7)),
        (180, 290, Color(red: 0.4, green: 0.8, blue: 1.0)),
        (225, 240, Color(red: 1.0, green: 0.84, blue: 0.0)),
        (270, 270, Color(red: 0.85, green: 0.55, blue: 1.0)),
        (315, 255, Color(red: 1.0, green: 0.84, blue: 0.0)),
    ]

    var body: some View {
        splashBody(ballRotation: .degrees(ballRotation), opened: opened, showFireworks: showFireworks, showBeams: showBeams, glowRadius: 96, fireworks: fireworks, beams: beams)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.18).delay(0.7)) {
                    ballRotation = -12
                }
                withAnimation(.easeInOut(duration: 0.16).delay(0.96)) {
                    ballRotation = 0
                }
                withAnimation(.easeInOut(duration: 0.2).delay(1.96)) {
                    ballRotation = 12
                }
            }
    }
}

// バックアップ: 採用した左右カタ、カタ版
struct TiltSequenceSplashView: View {
    @State private var ballRotation: Double = 0
    private let opened = false
    private let showFireworks = false
    private let showBeams = false

    private let fireworks: [(offset: CGSize, delay: Double, color: Color)] = [
        (CGSize(width: -100, height: -180), 0.0,  Color(red: 1.0, green: 0.84, blue: 0.0)),
        (CGSize(width:  120, height: -150), 0.08, Color(red: 1.0, green: 0.65, blue: 0.0)),
        (CGSize(width: -140, height:  -60), 0.15, Color(red: 0.85, green: 0.55, blue: 1.0)),
        (CGSize(width:  150, height:   40), 0.05, Color(red: 0.0, green: 0.9,  blue: 0.8)),
        (CGSize(width:  -50, height:  160), 0.12, Color(red: 1.0, green: 0.84, blue: 0.0)),
        (CGSize(width:   80, height:  170), 0.18, Color(red: 1.0, green: 0.4,  blue: 0.6)),
        (CGSize(width: -160, height:  120), 0.10, Color(red: 0.4, green: 0.8,  blue: 1.0)),
        (CGSize(width:  160, height: -100), 0.03, Color(red: 1.0, green: 0.92, blue: 0.5)),
    ]

    private let beams: [(angle: Double, length: CGFloat, color: Color)] = [
        (  0, 300, Color(red: 0.0, green: 0.9, blue: 0.7)),
        ( 45, 260, Color(red: 0.4, green: 0.8, blue: 1.0)),
        ( 90, 280, Color(red: 0.85, green: 0.55, blue: 1.0)),
        (135, 250, Color(red: 0.0, green: 0.9, blue: 0.7)),
        (180, 290, Color(red: 0.4, green: 0.8, blue: 1.0)),
        (225, 240, Color(red: 1.0, green: 0.84, blue: 0.0)),
        (270, 270, Color(red: 0.85, green: 0.55, blue: 1.0)),
        (315, 255, Color(red: 1.0, green: 0.84, blue: 0.0)),
    ]

    var body: some View {
        splashBody(ballRotation: .degrees(ballRotation), opened: opened, showFireworks: showFireworks, showBeams: showBeams, glowRadius: 96, fireworks: fireworks, beams: beams)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.18).delay(0.7)) {
                    ballRotation = -12
                }
                withAnimation(.easeInOut(duration: 0.16).delay(0.96)) {
                    ballRotation = 0
                }
                withAnimation(.easeInOut(duration: 0.2).delay(1.96)) {
                    ballRotation = 12
                }
            }
    }
}

private func splashBody(
    ballRotation: Angle,
    opened: Bool,
    showFireworks: Bool,
    showBeams: Bool,
    glowRadius: CGFloat,
    fireworks: [(offset: CGSize, delay: Double, color: Color)],
    beams: [(angle: Double, length: CGFloat, color: Color)]
) -> some View {
        ZStack {
            RadialGradient(
                colors: [
                    Color(red: 0.08, green: 0.05, blue: 0.18),
                    Color(red: 0.04, green: 0.02, blue: 0.10),
                    Color.black,
                ],
                center: .center,
                startRadius: 50,
                endRadius: 500
            )
            .ignoresSafeArea()

            Circle()
                .stroke(
                    LinearGradient(
                        colors: [
                            Color(red: 0.0, green: 0.8, blue: 0.6).opacity(0.12),
                            Color(red: 0.5, green: 0.3, blue: 1.0).opacity(0.06),
                        ],
                        startPoint: .top, endPoint: .bottom
                    ),
                    lineWidth: 2
                )
                .frame(width: 320, height: 320)
                .opacity(showBeams ? 1 : 0)

            Circle()
                .stroke(
                    Color(red: 1.0, green: 0.84, blue: 0.0).opacity(0.05),
                    lineWidth: 1.5
                )
                .frame(width: 260, height: 260)
                .opacity(showBeams ? 1 : 0)

            ForEach(0..<beams.count, id: \.self) { i in
                let beam = beams[i]
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [beam.color.opacity(0.5), beam.color.opacity(0)],
                            startPoint: .bottom, endPoint: .top
                        )
                    )
                    .frame(width: 3, height: showBeams ? beam.length : 0)
                    .offset(y: showBeams ? -beam.length / 2 - 55 : -55)
                    .rotationEffect(.degrees(beam.angle))
                    .opacity(showBeams ? 0.7 : 0)
            }

            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color(red: 1.0, green: 0.84, blue: 0.0).opacity(0.38),
                            Color(red: 1.0, green: 0.65, blue: 0.0).opacity(0.12),
                            Color.clear,
                        ],
                        center: .center,
                        startRadius: 24,
                        endRadius: glowRadius
                    )
                )
                .frame(width: 320, height: 320)

            Image("SplashIcon")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 400, height: 400)
                .offset(y: -20)
                .shadow(color: Color(red: 1.0, green: 0.84, blue: 0.0).opacity(0.4), radius: 24, y: 0)

            ForEach(0..<fireworks.count, id: \.self) { i in
                let fw = fireworks[i]
                FireworkBurst(color: fw.color, visible: showFireworks)
                    .offset(fw.offset)
            }
        }
}

// 花火の一発分（小さなパーティクルが放射状に広がる）
private struct FireworkBurst: View {
    let color: Color
    let visible: Bool

    // 8方向にパーティクルを飛ばす
    private let directions: [(dx: CGFloat, dy: CGFloat)] = [
        ( 0, -1), ( 0.7, -0.7), ( 1,  0), ( 0.7, 0.7),
        ( 0,  1), (-0.7,  0.7), (-1,  0), (-0.7, -0.7),
    ]

    var body: some View {
        ZStack {
            // 中心のフラッシュ
            Circle()
                .fill(color.opacity(visible ? 0.9 : 0))
                .frame(width: visible ? 6 : 2, height: visible ? 6 : 2)
                .blur(radius: 2)

            // パーティクル
            ForEach(0..<directions.count, id: \.self) { i in
                let d = directions[i]
                let dist: CGFloat = visible ? CGFloat.random(in: 18...32) : 0
                Circle()
                    .fill(color)
                    .frame(width: visible ? 3 : 1, height: visible ? 3 : 1)
                    .offset(x: d.dx * dist, y: d.dy * dist)
                    .opacity(visible ? Double.random(in: 0.6...1.0) : 0)
                    .blur(radius: 0.5)
            }

            // キラキラ（十字の光芒）
            ForEach(0..<4, id: \.self) { i in
                let angle = Double(i) * 45.0
                Capsule()
                    .fill(color.opacity(visible ? 0.7 : 0))
                    .frame(width: 1.5, height: visible ? 14 : 2)
                    .rotationEffect(.degrees(angle))
            }
        }
        .animation(.easeOut(duration: 0.5), value: visible)
    }
}

// ゴージャスボール — 黒+金のデザイン
private struct BaselineGorgeousBallMark: View {
    let opened: Bool

    private let gold = Color(red: 1.0, green: 0.84, blue: 0.0)
    private let darkGold = Color(red: 0.85, green: 0.65, blue: 0.0)

    var body: some View {
        ZStack {
            // 上半分（黒 + 金ストライプ）
            GorgeousBallHalf(top: true)
                .offset(y: opened ? -28 : 0)

            // 下半分（黒）
            GorgeousBallHalf(top: false)
                .offset(y: opened ? 28 : 0)

            // 中央のゴールドライン（横帯）
            Capsule()
                .fill(
                    LinearGradient(
                        colors: [darkGold, gold, gold, darkGold],
                        startPoint: .leading, endPoint: .trailing
                    )
                )
                .frame(width: opened ? 90 : 120, height: 8)
                .shadow(color: gold.opacity(0.6), radius: 4, y: 0)
                .opacity(opened ? 0.5 : 1)

            // 外側リング（金色の縁）
            Circle()
                .stroke(
                    LinearGradient(
                        colors: [gold, darkGold, gold],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ),
                    lineWidth: opened ? 2 : 3
                )
                .frame(width: 120, height: 120)
                .shadow(color: gold.opacity(0.4), radius: 6, y: 0)
                .opacity(opened ? 0.3 : 0.8)

            // 中央ボタン — ゴールドリング + ピンクの宝石
            ZStack {
                // 外側ゴールドリング
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [gold, darkGold],
                            center: .center,
                            startRadius: 8,
                            endRadius: 16
                        )
                    )
                    .frame(width: opened ? 24 : 32, height: opened ? 24 : 32)
                    .shadow(color: gold.opacity(0.8), radius: 8, y: 0)

                // 内側グレーリング
                Circle()
                    .fill(Color(red: 0.7, green: 0.7, blue: 0.72))
                    .frame(width: opened ? 18 : 24, height: opened ? 18 : 24)

                // ピンクの宝石
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color(red: 1.0, green: 0.7, blue: 0.85),
                                Color(red: 0.85, green: 0.3, blue: 0.6),
                                Color(red: 0.6, green: 0.1, blue: 0.4),
                            ],
                            center: UnitPoint(x: 0.35, y: 0.35),
                            startRadius: 0,
                            endRadius: 12
                        )
                    )
                    .frame(width: opened ? 12 : 16, height: opened ? 12 : 16)
                    .shadow(color: Color(red: 0.85, green: 0.3, blue: 0.6).opacity(0.6), radius: 4, y: 0)

                // 宝石のハイライト
                Circle()
                    .fill(Color.white.opacity(0.5))
                    .frame(width: 4, height: 4)
                    .offset(x: opened ? -2 : -3, y: opened ? -2 : -3)
            }
        }
        .animation(.spring(response: 0.7, dampingFraction: 0.78), value: opened)
    }
}

private struct GorgeousBallMark: View {
    let opened: Bool

    var body: some View {
        BaselineGorgeousBallMark(opened: opened)
    }
}

// ゴージャスボールの半球
private struct GorgeousBallHalf: View {
    let top: Bool

    private let gold = Color(red: 1.0, green: 0.84, blue: 0.0)
    private let darkGold = Color(red: 0.85, green: 0.65, blue: 0.0)

    var body: some View {
        ZStack {
            // 黒いベース
            Circle()
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.15, green: 0.12, blue: 0.08),
                            Color(red: 0.06, green: 0.04, blue: 0.02),
                        ],
                        startPoint: top ? .top : .bottom,
                        endPoint: top ? .bottom : .top
                    )
                )
                .frame(width: 120, height: 120)

            // ゴールドストライプ（上半分に2本のアーチ）
            if top {
                // 上のストライプ
                Circle()
                    .stroke(
                        LinearGradient(
                            colors: [gold.opacity(0.9), darkGold.opacity(0.6)],
                            startPoint: .leading, endPoint: .trailing
                        ),
                        lineWidth: 3
                    )
                    .frame(width: 90, height: 90)
                    .offset(y: 4)

                Circle()
                    .stroke(
                        LinearGradient(
                            colors: [darkGold.opacity(0.5), gold.opacity(0.3)],
                            startPoint: .leading, endPoint: .trailing
                        ),
                        lineWidth: 2
                    )
                    .frame(width: 110, height: 110)
                    .offset(y: 2)
            }

            // 光沢（上半分のハイライト）
            if top {
                Ellipse()
                    .fill(Color.white.opacity(0.08))
                    .frame(width: 60, height: 30)
                    .offset(y: -22)
            }
        }
        .mask(
            Rectangle()
                .frame(width: 120, height: 60)
                .offset(y: top ? -30 : 30)
        )
    }
}

class WebViewModel: ObservableObject {
    @Published var isLoading = true
    @Published var error: String?
    var webView: WKWebView?
    fileprivate var pendingAuthURL: URL?

    func reload() {
        error = nil
        isLoading = true
        webView?.load(URLRequest(url: URL(string: appBaseURLString)!))
    }

    func handleIncomingAuthURL(_ url: URL) {
        guard url.scheme?.lowercased() == "pokedamagecalc" else { return }
        guard let resolvedURL = resolveAuthCallbackURL(from: url) else { return }
        error = nil
        isLoading = true

        if let webView {
            webView.load(URLRequest(url: resolvedURL))
        } else {
            pendingAuthURL = resolvedURL
        }
    }

    private func resolveAuthCallbackURL(from url: URL) -> URL? {
        guard var components = URLComponents(string: appBaseURLString) else { return nil }

        let callbackPath: String
        if url.host == "auth" {
            let suffix = url.path.isEmpty ? "/callback" : url.path
            callbackPath = "/auth" + suffix
        } else {
            callbackPath = "/auth/callback"
        }

        components.path = callbackPath
        components.query = url.query
        components.fragment = url.fragment
        return components.url
    }
}

struct WebView: UIViewRepresentable {
    @ObservedObject var viewModel: WebViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator(viewModel: viewModel)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let controller = WKUserContentController()
        controller.addUserScript(WKUserScript(
            source: injectedViewportAndStyleScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        configuration.userContentController = controller

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = true
        webView.configuration.applicationNameForUserAgent = "PokeDamageCalcApp/1.0"

        viewModel.webView = webView
        if let pendingAuthURL = viewModel.pendingAuthURL {
            viewModel.pendingAuthURL = nil
            webView.load(URLRequest(url: pendingAuthURL))
        } else {
            webView.load(URLRequest(url: URL(string: appBaseURLString)!))
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    // ナビゲーションの成功・失敗を監視
    class Coordinator: NSObject, WKNavigationDelegate {
        let viewModel: WebViewModel

        init(viewModel: WebViewModel) {
            self.viewModel = viewModel
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.viewModel.isLoading = false
                self.viewModel.error = nil
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async {
                self.viewModel.isLoading = false
                self.viewModel.error = error.localizedDescription
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async {
                self.viewModel.isLoading = false
                self.viewModel.error = error.localizedDescription
            }
        }
    }
}

private let injectedViewportAndStyleScript = """
(function() {
  var viewportContent = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

  function ensureHeadReady(callback) {
    if (document.head) {
      callback();
      return;
    }
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  }

  function ensureViewport() {
    var viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', viewportContent);
  }

  function ensureStyle() {
    var style = document.getElementById('pokedamagecalc-app-style');
    if (style) return;
    style = document.createElement('style');
    style.id = 'pokedamagecalc-app-style';
    style.textContent = `
      html { -webkit-text-size-adjust: 100%; }
      body {
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
        overflow-x: hidden;
      }
      img, svg, video, canvas {
        max-width: 100%;
      }
      /* アプリ内では全画面幅でrangeスタイルを強制適用（メディアクエリなし） */
      input[type="range"],
      input[type="range"].pokedamagecalc-range {
        -webkit-appearance: none !important;
        appearance: none !important;
        accent-color: transparent !important;
        -webkit-tap-highlight-color: transparent !important;
        background: transparent !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        outline: none !important;
        height: 28px !important;
        padding: 8px 0 !important;
      }
      input[type="range"]::-webkit-slider-runnable-track,
      input[type="range"].pokedamagecalc-range::-webkit-slider-runnable-track {
        -webkit-appearance: none !important;
        appearance: none !important;
        height: 6px !important;
        border: 0 !important;
        border-radius: 9999px !important;
        background: #e5e7eb !important;
        box-shadow: none !important;
      }
      input[type="range"]::-webkit-slider-thumb,
      input[type="range"].pokedamagecalc-range::-webkit-slider-thumb {
        -webkit-appearance: none !important;
        appearance: none !important;
        width: 22px !important;
        height: 22px !important;
        margin-top: -8px !important;
        border: 2px solid #ffffff !important;
        border-radius: 9999px !important;
        background: #3b82f6 !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function applyRangeStyling(root) {
    var ranges = (root || document).querySelectorAll('input[type="range"]');
    ranges.forEach(function(el) {
      el.classList.add('pokedamagecalc-range');
      el.style.webkitAppearance = 'none';
      el.style.appearance = 'none';
      el.style.accentColor = 'transparent';
      el.style.background = 'transparent';
      el.style.border = '0';
      el.style.borderRadius = '0';
      el.style.boxShadow = 'none';
      el.style.height = '28px';
      el.style.paddingTop = '8px';
      el.style.paddingBottom = '8px';
    });
  }

  ensureHeadReady(function() {
    ensureViewport();
    ensureStyle();
    applyRangeStyling(document);

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (!(node instanceof Element)) return;
          if (node.matches && node.matches('input[type="range"]')) {
            applyRangeStyling(node.parentNode || document);
            return;
          }
          if (node.querySelectorAll) {
            applyRangeStyling(node);
          }
        });
      });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
})();
"""

#Preview {
    ContentView()
}
