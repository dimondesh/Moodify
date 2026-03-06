import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { axiosInstance } from "../lib/axios";
import StandardLoader from "../components/ui/StandardLoader";

export default function TrackRedirect() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTrackAndRedirect = async () => {
      try {
        const response = await axiosInstance.get("/songs/" + id);
        const song = response.data;

        const albumId =
          song.albumId || (song.album && song.album._id) || song.album;

        if (albumId) {
          navigate("/albums/" + albumId + "?play=" + id, { replace: true });
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
