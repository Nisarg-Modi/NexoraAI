import { useState, useEffect, useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Upload, FileText, AlertCircle, Trash2, Eye, Download, Camera as CameraIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  document_category: string;
  is_emergency_accessible: boolean;
  notes: string | null;
  created_at: string;
}

export const DocumentWallet = () => {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('id');
  const [notes, setNotes] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const isNative = Capacitor.isNativePlatform();

  const categories = [
    { value: 'id', label: 'ID Card' },
    { value: 'passport', label: 'Passport' },
    { value: 'license', label: "Driver's License" },
    { value: 'medical', label: 'Medical Records' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load documents',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const captureFromGallery = async () => {
    if (isNative) {
      try {
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos
        });

        if (image.dataUrl) {
          await uploadDocument(image.dataUrl, image.format || 'jpeg');
        }
      } catch (error) {
        console.error('Error accessing gallery:', error);
        toast({
          title: 'Error',
          description: 'Failed to access gallery',
          variant: 'destructive'
        });
      }
    } else {
      // Web fallback - trigger file input
      galleryInputRef.current?.click();
    }
  };

  const captureFromCamera = async () => {
    if (isNative) {
      try {
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera
        });

        if (image.dataUrl) {
          await uploadDocument(image.dataUrl, image.format || 'jpeg');
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        toast({
          title: 'Error',
          description: 'Failed to access camera',
          variant: 'destructive'
        });
      }
    } else {
      // Web fallback - trigger camera input
      cameraInputRef.current?.click();
    }
  };

  const handleWebCameraCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const format = file.type.split('/')[1] || 'jpeg';
      await uploadDocument(dataUrl, format);
    };
    reader.readAsDataURL(file);
    
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const handleWebGallerySelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const format = file.type.split('/')[1] || 'jpeg';
      await uploadDocument(dataUrl, format);
    };
    reader.readAsDataURL(file);
    
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      await uploadDocument(dataUrl, file.type.split('/')[1]);
    };
    reader.readAsDataURL(file);
  };

  const uploadDocument = async (dataUrl: string, format: string) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      const fileName = `${Date.now()}.${format}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, blob, {
          contentType: blob.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Save metadata
      const { error: insertError } = await supabase
        .from('user_documents')
        .insert({
          user_id: user.id,
          file_name: fileName,
          file_path: filePath,
          file_type: blob.type,
          file_size: blob.size,
          document_category: selectedCategory,
          is_emergency_accessible: isEmergency,
          notes: notes || null
        });

      if (insertError) throw insertError;

      toast({
        title: 'Success',
        description: 'Document uploaded successfully'
      });

      // Reset form
      setNotes('');
      setIsEmergency(false);
      await fetchDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload document',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (doc: Document) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('user_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      toast({
        title: 'Success',
        description: 'Document deleted successfully'
      });

      await fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive'
      });
    }
  };

  const viewDocument = async (doc: Document) => {
    try {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 60);

      if (data?.signedUrl) {
        setPreviewUrl(data.signedUrl);
        setPreviewDoc(doc);
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      toast({
        title: 'Error',
        description: 'Failed to load document',
        variant: 'destructive'
      });
    }
  };

  const downloadDocument = async (doc: Document) => {
    try {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 60);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: 'Error',
        description: 'Failed to download document',
        variant: 'destructive'
      });
    }
  };

  const getCategoryIcon = (category: string) => {
    return <FileText className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Loading documents...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Document Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Section */}
          <div className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label>Document Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this document..."
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={isEmergency}
                  onCheckedChange={setIsEmergency}
                  id="emergency"
                />
                <Label htmlFor="emergency" className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  Emergency Access
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button onClick={captureFromCamera} disabled={uploading} variant="secondary">
                <CameraIcon className="w-4 h-4 mr-2" />
                Camera
              </Button>
              <Button onClick={captureFromGallery} disabled={uploading} variant="secondary">
                <Upload className="w-4 h-4 mr-2" />
                Gallery
              </Button>
              <Button asChild variant="secondary" disabled={uploading}>
                <label className="cursor-pointer">
                  <FileText className="w-4 h-4 mr-2" />
                  File
                  <Input
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                  />
                </label>
              </Button>
            </div>
            
            {/* Hidden inputs for web camera/gallery fallback */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleWebCameraCapture}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleWebGallerySelect}
            />
          </div>

          {/* Documents List */}
          <div className="space-y-2">
            <h3 className="font-semibold">My Documents ({documents.length})</h3>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {documents.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          {getCategoryIcon(doc.document_category)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium truncate">{doc.file_name}</p>
                              {doc.is_emergency_accessible && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Emergency
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground capitalize">
                              {doc.document_category.replace('_', ' ')}
                            </p>
                            {doc.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{doc.notes}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => viewDocument(doc)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => downloadDocument(doc)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteDocument(doc)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {documents.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No documents yet. Upload your first document above.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => { setPreviewUrl(null); setPreviewDoc(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewDoc?.file_name}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {previewUrl && previewDoc?.file_type.startsWith('image/') && (
              <img src={previewUrl} alt={previewDoc.file_name} className="w-full rounded-lg" />
            )}
            {previewUrl && previewDoc?.file_type === 'application/pdf' && (
              <iframe src={previewUrl} className="w-full h-[600px] rounded-lg" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
