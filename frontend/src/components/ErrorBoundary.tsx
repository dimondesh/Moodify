// src/components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from "react";
import { ErrorFallbackUI } from "./ui/ErrorFallbackUI"; // Импортируем наш UI

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  // Этот метод обновляет стейт, чтобы следующий рендер показал запасной UI.
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // Этот метод вызывается после ошибки и идеально подходит для логирования
  // или выполнения побочных эффектов, как перезагрузка страницы.
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Здесь мы сохраняем вашу логику для ChunkLoadError!
    if (error.name === "ChunkLoadError") {
      window.location.reload();
    }
  }

  public render() {
    if (this.state.hasError) {
      // Если произошла ошибка, рендерим наш красивый компонент
      return <ErrorFallbackUI error={this.state.error} />;
    }

    // В противном случае, рендерим дочерние компоненты как обычно
    return this.props.children;
  }
}

export default ErrorBoundary;
