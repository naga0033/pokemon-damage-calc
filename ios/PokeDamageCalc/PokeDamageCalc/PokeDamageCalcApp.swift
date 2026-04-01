import SwiftUI

final class AppLinkRouter: ObservableObject {
    @Published var pendingURL: URL?

    func handleIncoming(_ url: URL) {
        pendingURL = url
    }

    func consume() {
        pendingURL = nil
    }
}

@main
struct PokeDamageCalcApp: App {
    @StateObject private var appLinkRouter = AppLinkRouter()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appLinkRouter)
                .onOpenURL { url in
                    appLinkRouter.handleIncoming(url)
                }
        }
    }
}
