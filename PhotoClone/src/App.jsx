import { useState, useEffect, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';

const COLUMNS = 6;

function App() {
  const [photos, setPhotos] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [activePhotoIndex, setActivePhotoIndex] = useState(null);
  const [scanProgress, setScanProgress] = useState(null);

  const loadPhotos = async () => {
    if (window.electronAPI) {
      const data = await window.electronAPI.getPhotos();
      setPhotos(data);
    }
  };

  useEffect(() => {
    loadPhotos();

    if (window.electronAPI) {
      window.electronAPI.onPhotoScanned((photo) => {
        setPhotos((prev) => {
          const newPhotos = [...prev, photo];
          return newPhotos.sort((a, b) => {
            const dateA = new Date(a.date_taken).getTime();
            const dateB = new Date(b.date_taken).getTime();
            return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA); // Descending
          });
        });
      });

      window.electronAPI.onScanProgress((progress) => {
        setScanProgress(progress);
      });

      window.electronAPI.onScanComplete(() => {
        setIsScanning(false);
        setScanProgress(null);
        setSelectedFolder('');
      });
    }
  }, []);

  const handleSelectMedia = async () => {
    if (window.electronAPI) {
      setIsScanning(true);
      const res = await window.electronAPI.selectMedia();
      if (res) {
        setSelectedFolder(res);
      } else {
        // Only reset if they literally selected nothing (i.e. cancelled the OS dialog). 
        // If they start a scan, the scan-complete event resets this.
        setIsScanning(false);
      }
    }
  };

  const handleCancel = async () => {
    if (window.electronAPI) {
      await window.electronAPI.cancelScan();
    }
  };

  // Prepare flattened data for Virtuoso to guarantee ultra-low memory
  const flattenedData = useMemo(() => {
    const grouped = photos.reduce((acc, photo) => {
      const d = new Date(photo.date_taken);
      const dateStr = isNaN(d.getTime()) ? 'Unknown Date' : d.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(photo);
      return acc;
    }, {});

    const flat = [];
    const flatPhotosOnly = []; // For lightbox navigation
    
    Object.keys(grouped).sort((a,b) => {
      if (a === 'Unknown Date') return 1;
      if (b === 'Unknown Date') return -1;
      return new Date(b) - new Date(a);
    }).forEach(dateStr => {
      flat.push({ type: 'header', title: dateStr });
      
      const groupPhotos = grouped[dateStr];
      for (let i = 0; i < groupPhotos.length; i += COLUMNS) {
        flat.push({
          type: 'row',
          items: groupPhotos.slice(i, i + COLUMNS)
        });
      }
      flatPhotosOnly.push(...groupPhotos);
    });

    return { flat, flatPhotosOnly };
  }, [photos]);

  const closeLightbox = () => setActivePhotoIndex(null);
  const nextPhoto = (e) => {
    e.stopPropagation();
    if (activePhotoIndex < flattenedData.flatPhotosOnly.length - 1) setActivePhotoIndex(activePhotoIndex + 1);
  };
  const prevPhoto = (e) => {
    e.stopPropagation();
    if (activePhotoIndex > 0) setActivePhotoIndex(activePhotoIndex - 1);
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">PhotoClone</h1>
          <p className="text-sm text-gray-400 mb-6">Your local photo library.</p>
          
          <div className="space-y-3">
            {isScanning ? (
              <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-gray-300 mb-1">
                  <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm font-medium">Processing Queue...</span>
                </div>
                
                {scanProgress && scanProgress.total > 0 && (
                  <div className="w-full">
                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                      <span>Uploading</span>
                      <span>{scanProgress.current} / {scanProgress.total}</span>
                    </div>
                    <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-2 transition-all duration-300 ease-out" 
                        style={{ width: `${Math.min(100, Math.round((scanProgress.current / scanProgress.total) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                
                <button 
                  onClick={handleCancel}
                  className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white font-medium py-1.5 px-4 rounded-md transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  Cancel Upload
                </button>
              </div>
            ) : (
              <button 
                onClick={handleSelectMedia}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                Upload
              </button>
            )}
          </div>
        </div>
        
        {selectedFolder && (
          <div className="px-6 py-4 mt-auto border-t border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Scanning Location</p>
            <p className="text-sm truncate text-gray-300" title={selectedFolder}>{selectedFolder}</p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col p-8 relative">
        {flattenedData.flat.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <h2 className="text-xl font-medium mb-2 text-gray-300">No photos yet</h2>
            <p>Select a folder to start indexing your library.</p>
          </div>
        ) : (
          <div className="flex-1 w-full max-w-6xl mx-auto">
            <Virtuoso
              data={flattenedData.flat}
              className="w-full h-full"
              itemContent={(_index, data) => {
                if (data.type === 'header') {
                  return (
                    <h3 className="text-lg font-medium text-gray-200 mb-4 mt-6 bg-gray-900/90 backdrop-blur-md py-2 sticky top-0 z-10">
                      {data.title}
                    </h3>
                  );
                }

                if (data.type === 'row') {
                  return (
                    <div className="grid grid-cols-6 gap-3 mb-3">
                      {data.items.map((photo) => {
                        const globalIndex = flattenedData.flatPhotosOnly.findIndex(p => p.id === photo.id);
                        return (
                          <div 
                            key={photo.id} 
                            onClick={() => setActivePhotoIndex(globalIndex)}
                            className="aspect-square relative group overflow-hidden rounded-md bg-gray-800 cursor-pointer"
                          >
                            <img 
                              src={`local-image://${photo.thumbnail_path}`} 
                              alt="Thumbnail" 
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200"></div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
              }}
            />
          </div>
        )}

        {/* Lightbox Overlay */}
        {activePhotoIndex !== null && flattenedData.flatPhotosOnly[activePhotoIndex] && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm" onClick={closeLightbox}>
            <button 
              className="absolute top-6 right-6 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
              onClick={closeLightbox}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            
            <button 
              className={`absolute left-6 text-white p-4 rounded-full hover:bg-white/10 transition-colors ${activePhotoIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'}`}
              onClick={prevPhoto}
              disabled={activePhotoIndex === 0}
            >
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>

            <img 
              src={`local-image://${flattenedData.flatPhotosOnly[activePhotoIndex].original_path}`} 
              alt="Full Resolution" 
              className="max-h-[90vh] max-w-[85vw] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()} // Prevent click from closing lightbox
            />

            <button 
              className={`absolute right-6 text-white p-4 rounded-full hover:bg-white/10 transition-colors ${activePhotoIndex === flattenedData.flatPhotosOnly.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'}`}
              onClick={nextPhoto}
              disabled={activePhotoIndex === flattenedData.flatPhotosOnly.length - 1}
            >
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
            
            <div className="absolute bottom-6 text-gray-400 text-sm bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
              {new Date(flattenedData.flatPhotosOnly[activePhotoIndex].date_taken).toLocaleString()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
