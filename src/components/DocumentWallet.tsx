import { useState, useEffect, useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Upload, FileText, AlertCircle, Trash2, Eye, Download, Camera as CameraIcon, ScanText, Loader2, Copy, RefreshCw, Search, X } from 'lucide-react';
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

interface StructuredOcrData {
  document_type: string;
  full_name: string | null;
  date_of_birth: string | null;
  id_number: string | null;
  address: string | null;
  expiry_date: string | null;
  issue_date: string | null;
  nationality: string | null;
  gender: string | null;
  additional_fields: Record<string, string>;
  raw_text: string;
}

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
  ocr_data?: StructuredOcrData | null;
  extracted_name?: string | null;
  extracted_dob?: string | null;
  extracted_id_number?: string | null;
  extracted_address?: string | null;
  extracted_expiry_date?: string | null;
  ocr_scanned_at?: string | null;
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
  const [ocrScanning, setOcrScanning] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<{ docId: string; text: string; structuredData?: StructuredOcrData } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
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
      // Cast the data to our Document type, handling the JSON field
      const typedDocs = (data || []).map(doc => ({
        ...doc,
        ocr_data: doc.ocr_data as unknown as StructuredOcrData | null
      }));
      setDocuments(typedDocs);
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

  // Filter documents based on search query
  const filteredDocuments = documents.filter(doc => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    
    // Search in file name
    if (doc.file_name.toLowerCase().includes(query)) return true;
    
    // Search in extracted name
    if (doc.extracted_name?.toLowerCase().includes(query)) return true;
    
    // Search in ID number
    if (doc.extracted_id_number?.toLowerCase().includes(query)) return true;
    
    // Search in address
    if (doc.extracted_address?.toLowerCase().includes(query)) return true;
    
    // Search in notes (includes OCR text)
    if (doc.notes?.toLowerCase().includes(query)) return true;
    
    // Search in document category
    if (doc.document_category.toLowerCase().includes(query)) return true;
    
    // Search in OCR structured data
    if (doc.ocr_data) {
      if (doc.ocr_data.document_type?.toLowerCase().includes(query)) return true;
      if (doc.ocr_data.full_name?.toLowerCase().includes(query)) return true;
      if (doc.ocr_data.nationality?.toLowerCase().includes(query)) return true;
      if (doc.ocr_data.raw_text?.toLowerCase().includes(query)) return true;
      // Search in additional fields
      if (doc.ocr_data.additional_fields) {
        for (const value of Object.values(doc.ocr_data.additional_fields)) {
          if (value?.toLowerCase().includes(query)) return true;
        }
      }
    }
    
    return false;
  });

  const scanDocumentOCR = async (doc: Document) => {
    if (!doc.file_type.startsWith('image/')) {
      toast({
        title: 'Not supported',
        description: 'OCR scanning is only available for image documents',
        variant: 'destructive'
      });
      return;
    }

    setOcrScanning(doc.id);
    try {
      // Get signed URL for the document
      const { data: urlData } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 300);

      if (!urlData?.signedUrl) {
        throw new Error('Failed to get document URL');
      }

      // Call the OCR edge function
      const { data, error } = await supabase.functions.invoke('document-ocr', {
        body: { imageUrl: urlData.signedUrl }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const structuredData = data.structuredData as StructuredOcrData | undefined;
      setOcrResult({ docId: doc.id, text: data.extractedText, structuredData });

      // Auto-save extracted text to document notes (replace old OCR if exists)
      let updatedNotes: string;
      const ocrMarker = '--- OCR Extracted Text ---';
      
      if (doc.notes?.includes(ocrMarker)) {
        // Replace existing OCR text
        const beforeOcr = doc.notes.split(ocrMarker)[0].trim();
        updatedNotes = beforeOcr 
          ? `${beforeOcr}\n\n${ocrMarker}\n${data.extractedText}`
          : `${ocrMarker}\n${data.extractedText}`;
      } else {
        // Add new OCR text
        updatedNotes = doc.notes 
          ? `${doc.notes}\n\n${ocrMarker}\n${data.extractedText}`
          : `${ocrMarker}\n${data.extractedText}`;
      }

      // Parse dates for database storage
      const parseDate = (dateStr: string | null | undefined): string | null => {
        if (!dateStr) return null;
        // Try to parse YYYY-MM-DD format
        const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (match) return dateStr;
        // Try other common formats
        try {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        } catch {
          // Ignore parsing errors
        }
        return null;
      };

      const { error: updateError } = await supabase
        .from('user_documents')
        .update({ 
          notes: updatedNotes,
          ocr_data: structuredData ? JSON.parse(JSON.stringify(structuredData)) : null,
          extracted_name: structuredData?.full_name || null,
          extracted_dob: parseDate(structuredData?.date_of_birth),
          extracted_id_number: structuredData?.id_number || null,
          extracted_address: structuredData?.address || null,
          extracted_expiry_date: parseDate(structuredData?.expiry_date),
          ocr_scanned_at: new Date().toISOString()
        })
        .eq('id', doc.id);

      if (updateError) {
        console.error('Error saving OCR to database:', updateError);
      } else {
        // Refresh documents to show updated data
        await fetchDocuments();
      }
      
      const isRescan = doc.notes?.includes(ocrMarker);
      toast({
        title: isRescan ? 'OCR Updated' : 'OCR Complete',
        description: `Extracted ${structuredData?.document_type || 'document'} data successfully`
      });
    } catch (error) {
      console.error('Error scanning document:', error);
      toast({
        title: 'OCR Failed',
        description: error instanceof Error ? error.message : 'Failed to extract text from document',
        variant: 'destructive'
      });
    } finally {
      setOcrScanning(null);
    }
  };

  const copyOcrText = async () => {
    if (ocrResult?.text) {
      await navigator.clipboard.writeText(ocrResult.text);
      toast({
        title: 'Copied',
        description: 'Extracted text copied to clipboard'
      });
    }
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">My Documents ({documents.length})</h3>
            </div>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, ID number, or text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            
            {searchQuery && (
              <p className="text-sm text-muted-foreground">
                Found {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} matching "{searchQuery}"
              </p>
            )}
            
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredDocuments.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          {getCategoryIcon(doc.document_category)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium truncate">
                                {doc.extracted_name || doc.file_name}
                              </p>
                              {doc.is_emergency_accessible && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Emergency
                                </Badge>
                              )}
                              {doc.ocr_data && (
                                <Badge variant="secondary" className="text-xs">
                                  {doc.ocr_data.document_type}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground capitalize">
                              {doc.document_category.replace('_', ' ')}
                            </p>
                            {/* Show extracted fields if available */}
                            {(doc.extracted_id_number || doc.extracted_dob) && (
                              <div className="flex flex-wrap gap-2 mt-1">
                                {doc.extracted_id_number && (
                                  <span className="text-xs bg-muted px-2 py-0.5 rounded">
                                    ID: {doc.extracted_id_number}
                                  </span>
                                )}
                                {doc.extracted_dob && (
                                  <span className="text-xs bg-muted px-2 py-0.5 rounded">
                                    DOB: {doc.extracted_dob}
                                  </span>
                                )}
                              </div>
                            )}
                            {doc.notes && !doc.notes.includes('--- OCR Extracted Text ---') && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{doc.notes}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(doc.created_at).toLocaleDateString()}
                              {doc.ocr_scanned_at && (
                                <span className="ml-2">• Scanned {new Date(doc.ocr_scanned_at).toLocaleDateString()}</span>
                              )}
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
                          {doc.file_type.startsWith('image/') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => scanDocumentOCR(doc)}
                              disabled={ocrScanning === doc.id}
                              title={doc.notes?.includes('--- OCR Extracted Text ---') ? 'Re-scan document (OCR)' : 'Extract text (OCR)'}
                            >
                              {ocrScanning === doc.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : doc.notes?.includes('--- OCR Extracted Text ---') ? (
                                <RefreshCw className="w-4 h-4" />
                              ) : (
                                <ScanText className="w-4 h-4" />
                              )}
                            </Button>
                          )}
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
                {filteredDocuments.length === 0 && documents.length > 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No documents match your search.
                  </div>
                )}
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

      {/* OCR Result Dialog */}
      <Dialog open={!!ocrResult} onOpenChange={() => setOcrResult(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanText className="w-5 h-5" />
              Extracted Data
              {ocrResult?.structuredData?.document_type && (
                <Badge variant="secondary" className="ml-2">
                  {ocrResult.structuredData.document_type}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {/* Structured Fields */}
            {ocrResult?.structuredData && (
              <div className="grid grid-cols-2 gap-3">
                {ocrResult.structuredData.full_name && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <Label className="text-xs text-muted-foreground">Full Name</Label>
                    <p className="font-medium">{ocrResult.structuredData.full_name}</p>
                  </div>
                )}
                {ocrResult.structuredData.date_of_birth && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <Label className="text-xs text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">{ocrResult.structuredData.date_of_birth}</p>
                  </div>
                )}
                {ocrResult.structuredData.id_number && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <Label className="text-xs text-muted-foreground">ID Number</Label>
                    <p className="font-medium">{ocrResult.structuredData.id_number}</p>
                  </div>
                )}
                {ocrResult.structuredData.nationality && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <Label className="text-xs text-muted-foreground">Nationality</Label>
                    <p className="font-medium">{ocrResult.structuredData.nationality}</p>
                  </div>
                )}
                {ocrResult.structuredData.gender && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <Label className="text-xs text-muted-foreground">Gender</Label>
                    <p className="font-medium">{ocrResult.structuredData.gender}</p>
                  </div>
                )}
                {ocrResult.structuredData.address && (
                  <div className="bg-muted/50 rounded-lg p-3 col-span-2">
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    <p className="font-medium">{ocrResult.structuredData.address}</p>
                  </div>
                )}
                {ocrResult.structuredData.issue_date && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <Label className="text-xs text-muted-foreground">Issue Date</Label>
                    <p className="font-medium">{ocrResult.structuredData.issue_date}</p>
                  </div>
                )}
                {ocrResult.structuredData.expiry_date && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <Label className="text-xs text-muted-foreground">Expiry Date</Label>
                    <p className="font-medium">{ocrResult.structuredData.expiry_date}</p>
                  </div>
                )}
                {ocrResult.structuredData.additional_fields && 
                  Object.entries(ocrResult.structuredData.additional_fields).map(([key, value]) => (
                    <div key={key} className="bg-muted/50 rounded-lg p-3">
                      <Label className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</Label>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))
                }
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={copyOcrText}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Raw Text
              </Button>
            </div>
            <ScrollArea className="h-[200px] rounded-lg border bg-muted/50 p-4">
              <pre className="whitespace-pre-wrap text-sm font-mono text-muted-foreground">
                {ocrResult?.structuredData?.raw_text || ocrResult?.text}
              </pre>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
