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

// スプラッシュ画面 — アイコンと同じ赤背景
struct SplashView: View {
    @State private var opened = false
    @State private var glowExpanded = false
    @State private var glowVisible = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.33, green: 0.07, blue: 0.12),
                    Color(red: 0.77, green: 0.11, blue: 0.18),
                    Color(red: 0.95, green: 0.36, blue: 0.23),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            Circle()
                .fill(Color.white.opacity(0.08))
                .frame(width: 280, height: 280)
                .offset(x: 120, y: -260)
                .blur(radius: 8)

            Circle()
                .stroke(Color.white.opacity(0.12), lineWidth: 28)
                .frame(width: 250, height: 250)
                .offset(x: -150, y: 310)

            VStack(spacing: 24) {
                ZStack {
                    Circle()
                        .fill(.ultraThinMaterial.opacity(0.35))
                        .frame(width: 136, height: 136)

                    Circle()
                        .stroke(Color.white.opacity(0.2), lineWidth: 1)
                        .frame(width: 120, height: 120)

                    Circle()
                        .fill(Color.white.opacity(glowVisible ? 0.92 : 0))
                        .frame(
                            width: glowExpanded ? 188 : 12,
                            height: glowExpanded ? 188 : 12
                        )
                        .blur(radius: glowExpanded ? 26 : 4)
                        .scaleEffect(glowExpanded ? 1.08 : 0.2)

                    MonsterBallMark(opened: opened)
                        .frame(width: 92, height: 92)
                }
                .shadow(color: .black.opacity(0.18), radius: 30, y: 14)

                VStack(spacing: 8) {
                    Text("ダメージ計算")
                        .font(.system(size: 30, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)

                    Text("Pokemon Champions")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .tracking(1.8)
                        .foregroundColor(.white.opacity(0.78))
                }

                HStack(spacing: 8) {
                    Capsule()
                        .fill(Color.white.opacity(0.95))
                        .frame(width: 22, height: 6)

                    Capsule()
                        .fill(Color.white.opacity(0.45))
                        .frame(width: 6, height: 6)

                    Capsule()
                        .fill(Color.white.opacity(0.45))
                        .frame(width: 6, height: 6)
                }
                .padding(.top, 8)
            }
            .padding(.horizontal, 32)
        }
        .onAppear {
            withAnimation(.spring(response: 0.75, dampingFraction: 0.82).delay(0.35)) {
                opened = true
            }

            withAnimation(.easeOut(duration: 0.12).delay(0.68)) {
                glowVisible = true
            }

            withAnimation(.easeOut(duration: 0.52).delay(0.72)) {
                glowExpanded = true
            }
        }
    }
}

private struct MonsterBallMark: View {
    let opened: Bool

    var body: some View {
        ZStack {
            BallHalf(top: true)
                .offset(y: opened ? -24 : 0)

            BallHalf(top: false)
                .offset(y: opened ? 24 : 0)

            Rectangle()
                .fill(Color(red: 0.04, green: 0.04, blue: 0.06))
                .frame(width: opened ? 72 : 92, height: 10)
                .opacity(opened ? 0.45 : 1)

            Circle()
                .fill(Color(red: 0.04, green: 0.04, blue: 0.06))
                .frame(width: opened ? 18 : 30, height: opened ? 18 : 30)
                .scaleEffect(opened ? 0.9 : 1)

            Circle()
                .fill(Color.white)
                .frame(width: opened ? 9 : 16, height: opened ? 9 : 16)
                .opacity(opened ? 0.78 : 1)

            Circle()
                .fill(Color.white.opacity(0.22))
                .frame(width: 18, height: 18)
                .offset(x: -18, y: -20)
                .opacity(opened ? 0.2 : 1)
        }
        .animation(.spring(response: 0.75, dampingFraction: 0.82), value: opened)
    }
}

private struct BallHalf: View {
    let top: Bool

    var body: some View {
        let base = Circle()
            .fill(
                top
                ? AnyShapeStyle(
                    LinearGradient(
                        colors: [
                            Color(red: 0.97, green: 0.30, blue: 0.26),
                            Color(red: 0.84, green: 0.12, blue: 0.16),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                : AnyShapeStyle(Color.white)
            )

        base
            .frame(width: 92, height: 92)
            .overlay(
                Circle()
                    .stroke(Color.black.opacity(top ? 0.12 : 0.18), lineWidth: 1)
            )
            .mask(
                Rectangle()
                    .frame(width: 92, height: 46)
                    .offset(y: top ? -23 : 23)
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
        let webView = WKWebView(frame: .zero)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.bounces = false
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

#Preview {
    ContentView()
}
