import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ModelErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CNC] Failed to initialize the 3D scene.', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="model-error" role="alert">
          <div>
            <span>Scene unavailable</span>
            <h2>The CNC model could not be loaded.</h2>
            <p>
              Confirm that <code>/models/CNC_V1_ExportTest_01.glb</code> is available, then reload the page.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
