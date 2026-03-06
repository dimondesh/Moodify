// frontend/src/pages/TrackRedirect.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { axiosInstance } from "../lib/axios";
import StandardLoader from "../components/ui/StandardLoader";
import { Helmet } from "react-helmet-async";

export default function TrackRedirect() {
  const { id } = useParams();
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    const fetchAndRedirect = async () => {
      try {
        // Используем твой эндпоинт из share.controller.js
        const res = await axiosInstance.get(`/share/song/${id}`);
        const song = res.data;
        setMeta(song);

        // Редиректим на альбом с параметром play
        if (song.albumId) {
          navigate(`/albums/${song.albumId}?play=${song._id}`, {
            replace: true,
          });
        } else {
          navigate("/", { replace: true });
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        navigate("/not-found", { replace: true });
      }
    };

    if (id) fetchAndRedirect();
  }, [id, navigate]);

  return (
    <div className="h-screen w-full bg-[#0f0f0f] flex items-center justify-center">
      {/* На случай, если бот умеет читать JS (например, Googlebot) */}
      {meta && (
        <Helmet>
          <title>{`${meta.title} - ${meta.artist?.[0]?.name} | Moodify`}</title>
          <meta
            property="og:title"
            content={`${meta.title} - ${meta.artist?.[0]?.name}`}
          />
          <meta property="og:description" content="Listen on Moodify" />
          <meta property="og:image" content={meta.imageUrl} />
          <meta property="og:type" content="music.song" />
        </Helmet>
      )}
      <StandardLoader size="lg" showText={false} />
    </div>
  );
}
