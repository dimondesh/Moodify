import { Navigate } from "react-router-dom";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DESKTOP_LIBRARY_MEDIA_QUERY } from "@/lib/libraryPlatform";
import LibraryPage from "./LibraryPage";

const LibraryRoute = () => {
  const isDesktopLibrary = useMediaQuery(DESKTOP_LIBRARY_MEDIA_QUERY);

  if (isDesktopLibrary) {
    return <Navigate to="/" replace />;
  }

  return <LibraryPage />;
};

export default LibraryRoute;
