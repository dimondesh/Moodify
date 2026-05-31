import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchSongById } from "@/lib/api/music";
import StandardLoader from "@/components/ui/StandardLoader";

export default function TrackRedirect() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTrackAndRedirect = async () => {
      if (!id) return;
      try {
        const song = await fetchSongById(id);
        const albumId = song.albumId;

        if (albumId) {
          navigate(`/albums/${albumId}?play=${id}`, { replace: true });
        } else {
          navigate("/", { replace: true });
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        navigate("/", { replace: true });
      }
    };

    if (id) {
      fetchTrackAndRedirect();
    }
  }, [id, navigate]);

  return (
    <div className="h-screen w-full bg-[#0f0f0f] flex items-center justify-center">
      <StandardLoader size="lg" showText={false} />
    </div>
  );
}
