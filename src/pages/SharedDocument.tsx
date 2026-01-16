import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, AlertCircle, Clock, Eye, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface SharedDocumentData {
  file_name: string;
  file_type: string;
  document_category: string;
  signed_url: string;
}

interface ShareResponse {
  success: boolean;
  document: SharedDocumentData;
  expires_at: string;
  access_count: number;
  max_access_count: number | null;
  error?: string;
}

const SharedDocument = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ShareResponse | null>(null);

  useEffect(() => {
    const fetchSharedDocument = async () => {
      if (!token) {
        setError("No share token provided");
        setLoading(false);
        return;
      }

      try {
        const { data: response, error: fnError } = await supabase.functions.invoke(
          "access-shared-document",
          { body: { token } }
        );

        if (fnError) {
          throw fnError;
        }

        if (response.error) {
          setError(response.error);
        } else {
          setData(response);
        }
      } catch (err) {
        console.error("Error fetching shared document:", err);
        setError("Failed to load shared document");
      } finally {
        setLoading(false);
      }
    };

    fetchSharedDocument();
  }, [token]);

  const handleDownload = () => {
    if (data?.document.signed_url) {
      window.open(data.document.signed_url, "_blank");
    }
  };

  const getCategoryIcon = (category: string) => {
    return <FileText className="h-12 w-12 text-primary" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading shared document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Unable to Access Document</h2>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getCategoryIcon(data.document.document_category)}
          </div>
          <CardTitle className="text-xl">{data.document.file_name}</CardTitle>
          <p className="text-sm text-muted-foreground capitalize">
            {data.document.document_category.replace("_", " ")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Expires: {format(new Date(data.expires_at), "PPp")}</span>
            </div>
          </div>

          {data.max_access_count && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>
                Viewed {data.access_count} of {data.max_access_count} times
              </span>
            </div>
          )}

          <Button onClick={handleDownload} className="w-full" size="lg">
            <Download className="h-4 w-4 mr-2" />
            Download Document
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            This is a secure shared document. The download link will expire shortly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SharedDocument;
