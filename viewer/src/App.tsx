import { useState } from 'react'
import './App.css'
import { WaveformPlayer } from './WaveformPlayer'

function App() {
  const [storagePath, setStoragePath] = useState('../lasagna_demo.ls')
  const [isOpen, setIsOpen] = useState(false)
  const [files, setFiles] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Single Player State
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)
  const [selectedAudioUrl, setSelectedAudioUrl] = useState<string | null>(null)
  const [ancestry, setAncestry] = useState<{ uuid: string, parentUUID: string }[]>([])

  // Granular loading states
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [loadingAncestry, setLoadingAncestry] = useState(false)

  const handleOpenPromise = async () => {
    try {
      setLoading(true)
      setError(null)
      await window.ipcRenderer.lasagna.openStorage(storagePath)
      setIsOpen(true)
      await loadFiles(1)
    } catch (err: any) {
      setError('Failed to open storage: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadFiles = async (p: number) => {
    try {
      setLoading(true)

      const res = await window.ipcRenderer.lasagna.listFiles(p, pageSize)
      setFiles(res.items)
      setTotal(res.total)
      setPage(p)

    } catch (err: any) {
      setError('Failed to list files: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const selectFile = async (uuid: string) => {
    try {
      if (selectedUuid === uuid) return;

      setSelectedUuid(uuid) // Update UI immediately to show panel

      // Cleanup previous player state
      if (selectedAudioUrl) {
        URL.revokeObjectURL(selectedAudioUrl)
        setSelectedAudioUrl(null)
      }
      setAncestry([])
      setError(null)

      // Start parallel loading
      setLoadingAudio(true)
      setLoadingAncestry(true)

      const audioPromise = (async () => {
        try {
          const data = await window.ipcRenderer.lasagna.getAudio(uuid)
          const blob = new Blob([data], { type: 'audio/wav' })
          const url = URL.createObjectURL(blob)
          setSelectedAudioUrl(url)
        } catch (e: any) {
          console.error("Audio error", e)
        } finally {
          setLoadingAudio(false)
        }
      })();

      const ancestryPromise = (async () => {
        try {
          const ancestryData = await window.ipcRenderer.lasagna.getAncestry(uuid)
          setAncestry(ancestryData)
        } catch (e: any) {
          console.error("Ancestry error", e)
        } finally {
          setLoadingAncestry(false)
        }
      })();

      await Promise.all([audioPromise, ancestryPromise])

    } catch (e: any) {
      setError(`Failed to select file: ${e.message}`)
      setLoadingAudio(false)
      setLoadingAncestry(false)
    }
  }

  return (
    <div className="container">
      <h1>LasagnaDB Viewer</h1>

      {!isOpen ? (
        <div className="open-section">
          <input
            type="text"
            value={storagePath}
            onChange={(e) => setStoragePath(e.target.value)}
            placeholder="Path to storage file"
          />
          <button onClick={handleOpenPromise} disabled={loading}>
            {loading ? 'Opening...' : 'Open Storage'}
          </button>
        </div>
      ) : (
        <div className="viewer-section">

          {/* Top Panel: Player & Info */}
          <div className="top-panel">
            {selectedUuid ? (
              <div className="player-container">
                <h2>Currently Playing: {selectedUuid}</h2>

                {loadingAudio && <div className="loading-state">Loading Audio...</div>}

                {!loadingAudio && selectedAudioUrl && (
                  <div className="main-player">
                    <WaveformPlayer
                      uuid={selectedUuid}
                      audioUrl={selectedAudioUrl}
                    />
                  </div>
                )}

                <div className="ancestry-section">
                  <h3>Ancestry Tree</h3>
                  {loadingAncestry ? (
                    <div className="loading-state">Loading Ancestry...</div>
                  ) : (
                    <div className="ancestry-list">
                      {ancestry.map((item, idx) => (
                        <div key={item.uuid} className="ancestry-item">
                          <span className="sc-idx">{idx + 1}.</span>
                          <span
                            className={`uuid-link ${item.uuid === selectedUuid ? 'current' : ''}`}
                            onClick={() => selectFile(item.uuid)}
                          >
                            {item.uuid}
                          </span>
                          {item.parentUUID && <span className="parent-arrow">→ Parent: {item.parentUUID}</span>}
                        </div>
                      ))}
                      {ancestry.length === 0 && <div>No ancestry data available.</div>}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="placeholder-panel">
                Select a file to play and view details.
              </div>
            )}
          </div>

          <div className="status-bar">
            <span>Storage: {storagePath}</span>
            <span>Total Files: {total}</span>
          </div>

          <div className="file-list-simple">
            <h3>File List</h3>
            {files.map(uuid => (
              <div
                key={uuid}
                className={`file-row ${selectedUuid === uuid ? 'active-row' : ''}`}
                onClick={() => selectFile(uuid)}
              >
                <span className="file-icon">📄</span>
                <span className="uuid">{uuid}</span>
              </div>
            ))}
          </div>

          <div className="pagination">
            <button
              disabled={page === 1 || loading}
              onClick={() => loadFiles(page - 1)}
            >
              Prev
            </button>
            <span>Page {page} of {Math.ceil(total / pageSize)}</span>
            <button
              disabled={page >= Math.ceil(total / pageSize) || loading}
              onClick={() => loadFiles(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  )
}

export default App
