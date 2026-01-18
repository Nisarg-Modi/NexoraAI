import { useState, useEffect, useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Upload, FileText, AlertCircle, Trash2, Eye, Download, Camera as CameraIcon, ScanText, Loader2, Copy, RefreshCw, Search, X, Clock, AlertTriangle, Calendar, Pencil, Share2, Link, Check, LinkIcon, ExternalLink, Filter, ArrowUpDown, CheckSquare, Square, XCircle } from 'lucide-react';
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

interface ShareLink {
  id: string;
  document_id: string;
  share_token: string;
  expires_at: string;
  max_access_count: number | null;
  accessed_count: number | null;
  is_active: boolean | null;
  created_at: string;
  document?: Document;
}

export const DocumentWallet = () => {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('id');
  const [notes, setNotes] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [manualExpiryDate, setManualExpiryDate] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [ocrScanning, setOcrScanning] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<{ docId: string; text: string; structuredData?: StructuredOcrData } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'category'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [editingExpiryDoc, setEditingExpiryDoc] = useState<Document | null>(null);
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [sharingDoc, setSharingDoc] = useState<Document | null>(null);
  const [shareExpiry, setShareExpiry] = useState('24');
  const [shareMaxAccess, setShareMaxAccess] = useState('');
  const [generatingShare, setGeneratingShare] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeShareLinks, setActiveShareLinks] = useState<ShareLink[]>([]);
  const [showActiveLinks, setShowActiveLinks] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [revokingLinkId, setRevokingLinkId] = useState<string | null>(null);
  
  // Batch selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [showBatchShareDialog, setShowBatchShareDialog] = useState(false);
  const [batchSharing, setBatchSharing] = useState(false);
  const [batchShareResults, setBatchShareResults] = useState<{ docName: string; link: string }[]>([]);
  
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
          notes: notes || null,
          extracted_expiry_date: manualExpiryDate || null
        });

      if (insertError) throw insertError;

      toast({
        title: 'Success',
        description: 'Document uploaded successfully'
      });

      // Reset form
      setNotes('');
      setIsEmergency(false);
      setManualExpiryDate('');
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

  // Calculate days until expiry
  const getExpiryStatus = (expiryDate: string | null | undefined): { 
    daysUntil: number | null; 
    status: 'expired' | 'critical' | 'warning' | 'soon' | 'ok' | null;
    label: string | null;
  } => {
    if (!expiryDate) return { daysUntil: null, status: null, label: null };
    
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    
    const diffTime = expiry.getTime() - today.getTime();
    const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) {
      return { daysUntil, status: 'expired', label: 'Expired' };
    } else if (daysUntil <= 30) {
      return { daysUntil, status: 'critical', label: `Expires in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}` };
    } else if (daysUntil <= 60) {
      return { daysUntil, status: 'warning', label: `Expires in ${daysUntil} days` };
    } else if (daysUntil <= 90) {
      return { daysUntil, status: 'soon', label: `Expires in ${daysUntil} days` };
    }
    
    return { daysUntil, status: 'ok', label: null };
  };

  // Get documents with expiry alerts
  const getExpiringDocuments = () => {
    return documents
      .filter(doc => {
        const { status } = getExpiryStatus(doc.extracted_expiry_date);
        return status === 'expired' || status === 'critical' || status === 'warning' || status === 'soon';
      })
      .sort((a, b) => {
        const aExpiry = a.extracted_expiry_date ? new Date(a.extracted_expiry_date).getTime() : Infinity;
        const bExpiry = b.extracted_expiry_date ? new Date(b.extracted_expiry_date).getTime() : Infinity;
        return aExpiry - bExpiry;
      });
  };

  const expiringDocuments = getExpiringDocuments();

  // Filter documents based on search query and category
  const filteredDocuments = documents.filter(doc => {
    // First apply category filter
    if (categoryFilter !== 'all' && doc.document_category !== categoryFilter) {
      return false;
    }
    
    // Then apply search filter
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

  // Count documents per category
  const categoryCounts = documents.reduce((acc, doc) => {
    acc[doc.document_category] = (acc[doc.document_category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Sort filtered documents
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case 'name':
        const nameA = (a.extracted_name || a.file_name).toLowerCase();
        const nameB = (b.extracted_name || b.file_name).toLowerCase();
        comparison = nameA.localeCompare(nameB);
        break;
      case 'category':
        comparison = a.document_category.localeCompare(b.document_category);
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Batch selection functions
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedDocIds(new Set());
  };

  const toggleDocumentSelection = (docId: string) => {
    const newSelected = new Set(selectedDocIds);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedDocIds(newSelected);
  };

  const selectAllDocuments = () => {
    setSelectedDocIds(new Set(sortedDocuments.map(doc => doc.id)));
  };

  const deselectAllDocuments = () => {
    setSelectedDocIds(new Set());
  };

  const batchDeleteDocuments = async () => {
    if (selectedDocIds.size === 0) return;
    setBatchDeleting(true);
    let successCount = 0;
    const docsToDelete = documents.filter(doc => selectedDocIds.has(doc.id));

    for (const doc of docsToDelete) {
      try {
        await supabase.storage.from('documents').remove([doc.file_path]);
        await supabase.from('user_documents').delete().eq('id', doc.id);
        successCount++;
      } catch (e) { /* continue */ }
    }

    toast({ title: 'Batch Delete', description: `${successCount} documents deleted` });
    setSelectedDocIds(new Set());
    setSelectionMode(false);
    setBatchDeleting(false);
    fetchDocuments();
  };

  const batchShareDocuments = async () => {
    if (selectedDocIds.size === 0) return;
    setBatchSharing(true);
    const results: { docName: string; link: string }[] = [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBatchSharing(false); return; }

    for (const docId of selectedDocIds) {
      const doc = documents.find(d => d.id === docId);
      if (!doc) continue;
      try {
        const tokenArray = new Uint8Array(32);
        crypto.getRandomValues(tokenArray);
        const shareToken = Array.from(tokenArray).map(b => b.toString(16).padStart(2, '0')).join('');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + parseInt(shareExpiry));

        await supabase.from('document_share_links').insert({
          document_id: doc.id,
          user_id: user.id,
          share_token: shareToken,
          expires_at: expiresAt.toISOString(),
          max_access_count: shareMaxAccess ? parseInt(shareMaxAccess) : null,
        });

        results.push({ docName: doc.extracted_name || doc.file_name, link: `${window.location.origin}/shared-document?token=${shareToken}` });
      } catch (e) { /* continue */ }
    }

    setBatchShareResults(results);
    setBatchSharing(false);
    if (results.length > 0) toast({ title: 'Share Links Generated', description: `${results.length} links created` });
  };

  const copyAllBatchLinks = () => {
    navigator.clipboard.writeText(batchShareResults.map(r => `${r.docName}: ${r.link}`).join('\n'));
    toast({ title: 'Copied', description: 'All links copied' });
  };

  const closeBatchShareDialog = () => {
    setShowBatchShareDialog(false);
    setBatchShareResults([]);
    setSelectedDocIds(new Set());
    setSelectionMode(false);
  };

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

  const openEditExpiry = (doc: Document) => {
    setEditingExpiryDoc(doc);
    setEditExpiryDate(doc.extracted_expiry_date || '');
  };

  const saveExpiryDate = async () => {
    if (!editingExpiryDoc) return;

    try {
      const { error } = await supabase
        .from('user_documents')
        .update({ extracted_expiry_date: editExpiryDate || null })
        .eq('id', editingExpiryDoc.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Expiry date updated successfully'
      });

      setEditingExpiryDoc(null);
      setEditExpiryDate('');
      await fetchDocuments();
    } catch (error) {
      console.error('Error updating expiry date:', error);
      toast({
        title: 'Error',
        description: 'Failed to update expiry date',
        variant: 'destructive'
      });
    }
  };

  const clearExpiryDate = async () => {
    if (!editingExpiryDoc) return;

    try {
      const { error } = await supabase
        .from('user_documents')
        .update({ extracted_expiry_date: null })
        .eq('id', editingExpiryDoc.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Expiry date removed'
      });

      setEditingExpiryDoc(null);
      setEditExpiryDate('');
      await fetchDocuments();
    } catch (error) {
      console.error('Error clearing expiry date:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear expiry date',
        variant: 'destructive'
      });
    }
  };

  const openShareDialog = (doc: Document) => {
    setSharingDoc(doc);
    setShareExpiry('24');
    setShareMaxAccess('');
    setShareLink(null);
    setCopiedLink(false);
  };

  const generateShareLink = async () => {
    if (!sharingDoc) return;

    setGeneratingShare(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate a secure random token
      const tokenArray = new Uint8Array(32);
      crypto.getRandomValues(tokenArray);
      const shareToken = Array.from(tokenArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(shareExpiry));

      // Insert share link record
      const { error } = await supabase
        .from('document_share_links')
        .insert({
          document_id: sharingDoc.id,
          user_id: user.id,
          share_token: shareToken,
          expires_at: expiresAt.toISOString(),
          max_access_count: shareMaxAccess ? parseInt(shareMaxAccess) : null,
        });

      if (error) throw error;

      // Generate the share URL
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/shared-document?token=${shareToken}`;
      setShareLink(link);

      toast({
        title: 'Share Link Created',
        description: `Link expires in ${shareExpiry} hours`
      });
    } catch (error) {
      console.error('Error generating share link:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate share link',
        variant: 'destructive'
      });
    } finally {
      setGeneratingShare(false);
    }
  };

  const copyShareLink = async () => {
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink);
      setCopiedLink(true);
      toast({
        title: 'Copied',
        description: 'Share link copied to clipboard'
      });
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const fetchActiveShareLinks = async () => {
    setLoadingLinks(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('document_share_links')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Attach document info to each share link
      const linksWithDocs = (data || []).map(link => {
        const doc = documents.find(d => d.id === link.document_id);
        return { ...link, document: doc };
      });

      setActiveShareLinks(linksWithDocs);
    } catch (error) {
      console.error('Error fetching share links:', error);
      toast({
        title: 'Error',
        description: 'Failed to load share links',
        variant: 'destructive'
      });
    } finally {
      setLoadingLinks(false);
    }
  };

  const openActiveLinksDialog = async () => {
    setShowActiveLinks(true);
    await fetchActiveShareLinks();
  };

  const revokeShareLink = async (linkId: string) => {
    setRevokingLinkId(linkId);
    try {
      const { error } = await supabase
        .from('document_share_links')
        .update({ is_active: false })
        .eq('id', linkId);

      if (error) throw error;

      toast({
        title: 'Link Revoked',
        description: 'The share link has been deactivated'
      });

      // Refresh the list
      await fetchActiveShareLinks();
    } catch (error) {
      console.error('Error revoking share link:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke share link',
        variant: 'destructive'
      });
    } finally {
      setRevokingLinkId(null);
    }
  };

  const copyActiveLinkToClipboard = async (token: string) => {
    const link = `${window.location.origin}/shared-document?token=${token}`;
    await navigator.clipboard.writeText(link);
    toast({
      title: 'Copied',
      description: 'Share link copied to clipboard'
    });
  };

  const getTimeRemaining = (expiresAt: string): string => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} remaining`;
    }
    if (diffHours > 0) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} remaining`;
    }
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} remaining`;
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

              <div>
                <Label>Expiry Date (Optional)</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={manualExpiryDate}
                    onChange={(e) => setManualExpiryDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Set when this document expires (can also be extracted via OCR)
                </p>
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

          {/* Expiry Alerts Section */}
          {expiringDocuments.length > 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <h4 className="font-semibold text-destructive">Document Expiry Alerts</h4>
                </div>
                <div className="space-y-2">
                  {expiringDocuments.map(doc => {
                    const { status, label, daysUntil } = getExpiryStatus(doc.extracted_expiry_date);
                    return (
                      <div 
                        key={`expiry-${doc.id}`}
                        className="flex items-center justify-between p-2 rounded-lg bg-background"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className={`w-4 h-4 ${
                            status === 'expired' ? 'text-destructive' :
                            status === 'critical' ? 'text-destructive' :
                            status === 'warning' ? 'text-orange-500' :
                            'text-yellow-500'
                          }`} />
                          <span className="font-medium text-sm">
                            {doc.extracted_name || doc.file_name}
                          </span>
                        </div>
                        <Badge 
                          variant={status === 'expired' || status === 'critical' ? 'destructive' : 'secondary'}
                          className={`text-xs ${
                            status === 'warning' ? 'bg-orange-500/10 text-orange-600 border-orange-500/30' :
                            status === 'soon' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' : ''
                          }`}
                        >
                          {label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">My Documents ({documents.length})</h3>
              <div className="flex items-center gap-2">
                <Button 
                  variant={selectionMode ? "default" : "outline"} 
                  size="sm" 
                  onClick={toggleSelectionMode}
                >
                  <CheckSquare className="w-4 h-4 mr-1" />
                  {selectionMode ? 'Cancel' : 'Select'}
                </Button>
                <Button variant="outline" size="sm" onClick={openActiveLinksDialog}>
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Active Links
                </Button>
              </div>
            </div>
            
            {/* Selection Actions Bar */}
            {selectionMode && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <span className="text-sm font-medium">{selectedDocIds.size} selected</span>
                <Button variant="ghost" size="sm" onClick={selectAllDocuments}>Select All</Button>
                <Button variant="ghost" size="sm" onClick={deselectAllDocuments}>Deselect</Button>
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => setShowBatchShareDialog(true)} disabled={selectedDocIds.size === 0}>
                  <Share2 className="w-4 h-4 mr-1" />Share
                </Button>
                <Button variant="destructive" size="sm" onClick={batchDeleteDocuments} disabled={selectedDocIds.size === 0 || batchDeleting}>
                  {batchDeleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                  Delete
                </Button>
              </div>
            )}
            
            {/* Search and Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
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
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label} {categoryCounts[cat.value] ? `(${categoryCounts[cat.value]})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <Select value={sortBy} onValueChange={(value: 'date' | 'name' | 'category') => setSortBy(value)}>
                <SelectTrigger className="w-[120px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={toggleSortDirection}
                className="h-8 px-2"
                title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
              >
                <ArrowUpDown className="w-4 h-4" />
                <span className="ml-1 text-xs">{sortDirection === 'asc' ? 'Asc' : 'Desc'}</span>
              </Button>
            </div>
            
            {(searchQuery || categoryFilter !== 'all') && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Found {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
                  {searchQuery && ` matching "${searchQuery}"`}
                  {categoryFilter !== 'all' && ` in ${categories.find(c => c.value === categoryFilter)?.label}`}
                </p>
                {(searchQuery || categoryFilter !== 'all') && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                    <X className="w-3 h-3 mr-1" />
                    Clear filters
                  </Button>
                )}
              </div>
            )}
            
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {sortedDocuments.map((doc) => (
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
                              {/* Expiry badge in document list */}
                              {(() => {
                                const { status, label } = getExpiryStatus(doc.extracted_expiry_date);
                                if (status && status !== 'ok') {
                                  return (
                                    <Badge 
                                      variant={status === 'expired' || status === 'critical' ? 'destructive' : 'secondary'}
                                      className={`text-xs ${
                                        status === 'warning' ? 'bg-orange-500/10 text-orange-600 border-orange-500/30' :
                                        status === 'soon' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' : ''
                                      }`}
                                    >
                                      <Clock className="w-3 h-3 mr-1" />
                                      {label}
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            <p className="text-sm text-muted-foreground capitalize">
                              {doc.document_category.replace('_', ' ')}
                            </p>
                            {/* Show extracted fields if available */}
                            {(doc.extracted_id_number || doc.extracted_dob || doc.extracted_expiry_date) && (
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
                                {doc.extracted_expiry_date && (
                                  <span className="text-xs bg-muted px-2 py-0.5 rounded">
                                    Expires: {doc.extracted_expiry_date}
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
                            onClick={() => openEditExpiry(doc)}
                            title="Edit expiry date"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openShareDialog(doc)}
                            title="Share document"
                          >
                            <Share2 className="w-4 h-4" />
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
                {sortedDocuments.length === 0 && documents.length > 0 && (
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

      {/* Edit Expiry Date Dialog */}
      <Dialog open={!!editingExpiryDoc} onOpenChange={() => { setEditingExpiryDoc(null); setEditExpiryDate(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Edit Expiry Date
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Document: <span className="font-medium text-foreground">{editingExpiryDoc?.extracted_name || editingExpiryDoc?.file_name}</span>
              </p>
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={editExpiryDate}
                onChange={(e) => setEditExpiryDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex justify-between gap-2">
              {editingExpiryDoc?.extracted_expiry_date && (
                <Button variant="outline" onClick={clearExpiryDate} className="text-destructive">
                  Remove Date
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => { setEditingExpiryDoc(null); setEditExpiryDate(''); }}>
                  Cancel
                </Button>
                <Button onClick={saveExpiryDate} disabled={!editExpiryDate}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Document Dialog */}
      <Dialog open={!!sharingDoc} onOpenChange={() => { setSharingDoc(null); setShareLink(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Share Document
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Document: <span className="font-medium text-foreground">{sharingDoc?.extracted_name || sharingDoc?.file_name}</span>
              </p>
            </div>

            {!shareLink ? (
              <>
                <div>
                  <Label>Link Expires In</Label>
                  <Select value={shareExpiry} onValueChange={setShareExpiry}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="6">6 hours</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="72">3 days</SelectItem>
                      <SelectItem value="168">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Max Access Count (Optional)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="Unlimited"
                    value={shareMaxAccess}
                    onChange={(e) => setShareMaxAccess(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for unlimited access
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSharingDoc(null)}>
                    Cancel
                  </Button>
                  <Button onClick={generateShareLink} disabled={generatingShare}>
                    {generatingShare ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Link className="w-4 h-4 mr-2" />
                        Generate Link
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Share Link:</p>
                  <p className="text-sm font-mono break-all">{shareLink}</p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={copyShareLink} className="flex-1">
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Link
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => { setSharingDoc(null); setShareLink(null); }}>
                    Done
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  This link will expire in {shareExpiry} hour{parseInt(shareExpiry) !== 1 ? 's' : ''}.
                  {shareMaxAccess && ` Limited to ${shareMaxAccess} access${parseInt(shareMaxAccess) !== 1 ? 'es' : ''}.`}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Share Links Dialog */}
      <Dialog open={showActiveLinks} onOpenChange={setShowActiveLinks}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Active Share Links
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {loadingLinks ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeShareLinks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <LinkIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No active share links</p>
                <p className="text-sm mt-1">Share a document to create a link</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                  {activeShareLinks.map((link) => (
                    <Card key={link.id}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {link.document?.extracted_name || link.document?.file_name || 'Unknown Document'}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {getTimeRemaining(link.expires_at)}
                              </Badge>
                              {link.max_access_count && (
                                <Badge variant="outline" className="text-xs">
                                  {link.accessed_count || 0}/{link.max_access_count} uses
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Created {new Date(link.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyActiveLinkToClipboard(link.share_token)}
                              title="Copy link"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(`/shared-document?token=${link.share_token}`, '_blank')}
                              title="Open link"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => revokeShareLink(link.id)}
                              disabled={revokingLinkId === link.id}
                              title="Revoke link"
                              className="text-destructive hover:text-destructive"
                            >
                              {revokingLinkId === link.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowActiveLinks(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
