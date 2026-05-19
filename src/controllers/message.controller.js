const Subscription = require("../models/subscription.model.js");
const Message = require("../models/message.model");
const File = require("../models/workspace.model");
const aiService = require("../services/ai.service");
const PayloadBuilder = require("../utils/payloadBuilder");
const { supabaseAdmin } = require("../config/supabase");
const Profile = require("../models/profile.js");
const { getMandatoryNextStep } = require("../utils/workflowMatrix");
const { storeBase64Image } = require("../services/profileStorageService.js");
const { supabaseStorage } = require("../services/supabaseStorage");
const OCRService = require("../services/ocrService")
const { default: classifierService, resolveEmailType } = require("../services/outputClassifier.js");
const fs = require('fs');
const path = require('path');
const { extractAiComponents } = require("../utils/aiExtractor");
// const { classifyAudience } = require("../services/audienceClassifier.js");
const { extractClaimContext, extractUnifiedContext } = require("../utils/contextExtractor.js");
const ContextService = require("../services/context.service.js");
const { parseAIResponse } = require("../utils/responseParser");
const { refinementMap, BASE_REFINEMENT_RULES } = require("../utils/prompt.js");
const { generateValidatedNextStep } = require("../services/nextstep.service.js");
const { deductCredits } = require("../utils/creditHelper.js");

// Example usage in your controller
const uploadDir = path.join(__dirname, '../uploads');


const updateWorkspaceActivity = async (fileId) => {
    await supabaseAdmin
        .from("files")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", fileId);
};


const testCreateMessage = async (req, res) => {
    try {
        const { workspace_id, user_input, image_input_url } = req.body;
        const userId = req.user.id;

        // 1. Simulate AI Classification and Logic (Internal)
        // In production, this data comes from your OpenAI/Workflow engine
        const aiSimulatedResponse = "AI drafts a short insured update while keeping claim context visible.";
        const classification = "email_insured";
        const nextStep = "Confirm document review timing";
        const actions = ["Edit Email", "Send Now", "Create File Note"];

        // 2. Save the entire interaction as ONE single row
        const turnResult = await Message.create(req.supabase, {
            workspace_id,
            user_id: userId,
            user_input: user_input,
            image_input_url: image_input_url || null,
            ai_response: aiSimulatedResponse,
            content_type: classification,
            claim_state: 'document_collection_pending',
            next_step_suggestion: nextStep,
            quick_actions: actions,
            activity_type: 'communication_sent',
            metadata: {
                engine_version: "1.0.0",
                confidence_score: 0.95
            }
        });

        // 3. Return the single object to the frontend
        console.log("Test Create Message Result:", turnResult.id);
        return res.status(201).json({
            success: true,
            data: turnResult
        });

    } catch (error) {
        console.error("Interaction Creation Error:", error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
/**
 * 2. Get File Drafts: Fetches all drafts for a specific workspace
 */
const getFileDrafts = async (req, res) => {
    try {
        const { fileId } = req.params;
        const userId = req.user.id;

        if (!fileId) {
            return res.status(400).json({
                success: false,
                message: "File ID is required"
            });
        }

        // 1. Validate workspace ownership
        const workspace = await File.findById(req.supabase, fileId);

        if (!workspace) {
            return res.status(404).json({
                success: false,
                message: "Workspace not found"
            });
        }

        if (workspace.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access"
            });
        }

        // 2. Fetch drafts
        const drafts = await Message.findByWorkspaceId(req.supabase, fileId);

        const formattedDrafts = drafts.map((draft) => {

            const imageAttachment = draft.image_storage_path
                ? {
                    available: true,
                    type: "image",
                    fileName: draft.image_metadata?.original_name || "image",
                    mimeType: draft.image_metadata?.mime_type || null,
                    size: draft.image_metadata?.size || null
                }
                : null;

            const documentAttachment = draft.document_storage_path
                ? {
                    available: true,
                    type: "document",
                    fileName: draft.document_metadata?.original_name || "document",
                    mimeType: draft.document_metadata?.mime_type || null,
                    size: draft.document_metadata?.size || null
                }
                : null;

            return {
                id: draft.id,
                workspace_id: draft.workspace_id,
                content_type: draft.content_type,
                claim_state: draft.claim_state,
                activity_type: draft.activity_type,

                user_input: draft.user_input,
                ai_response: draft.ai_response,

                next_step_suggestion: draft.next_step_suggestion,
                quick_actions: draft.quick_actions,

                response_used: draft.response_used,
                parent_id: draft.parent_id,
                version_index: draft.version_index,
                variant_label: draft.variant_label,
                refinement_type: draft.refinement_type,

                attachments: {
                    image: imageAttachment,
                    document: documentAttachment
                },

                created_at: draft.created_at,
                updated_at: draft.updated_at
            };
        });

        res.status(200).json({
            success: true,
            count: formattedDrafts.length,
            drafts: formattedDrafts
        });

    } catch (error) {
        console.error("Get File Drafts Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Error fetching drafts for this workspace"
        });
    }
};

/**
 * 3. All Drafts: Comprehensive history for the current user
 */
const AllDrafts = async (req, res) => {
    try {
        const userId = req.user.id;
        const drafts = await Message.findAllByUser(req.supabase, userId);
        res.status(200).json({
            success: true,
            count: drafts.length,
            data: drafts
        });
    } catch (error) {
        console.error("All Drafts Error:", error.message);
        res.status(500).json({ success: false, message: "Failed to fetch draft history." });
    }
};

/**
 * 4. Recent Drafts: Quick view activity (limited)
 */
const getRecentDrafts = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 2;

        const recentDrafts = await Message.findRecent(req.supabase, userId, limit);

        res.status(200).json({
            success: true,
            count: recentDrafts.length,
            data: recentDrafts
        });
    } catch (error) {
        console.error("Recent Drafts Error:", error.message);
        res.status(500).json({ success: false, message: "Failed to fetch recent activity." });
    }
};


const deleteDraft = async (req, res) => {
    try {
        const { draftId } = req.params;
        const userId = req.user.id;

        const draft = await Message.findById(req.supabase, draftId);
        if (!draft) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        // Security check: Ensure user owns the draft
        if (draft.user_id !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized deletion" });
        }

        await Message.deleteById(req.supabase, draftId);
        res.status(200).json({ success: true, message: "Message deleted successfully" });
    } catch (error) {
        console.error("Delete Message Error:", error.message);
        res.status(500).json({ success: false, message: "Error deleting draft" });
    }
};


const updateDraft = async (req, res) => {
    try {
        const { draftId } = req.params;
        const userId = req.user.id;

        const updateData = req.body;

        const existingMessage = await Message.findById(req.supabase, draftId);

        if (!existingMessage) {
            return res.status(404).json({
                success: false,
                message: "Interaction not found."
            });
        }

        if (existingMessage.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: You do not own this interaction."
            });
        }


        const updatedTurn = await Message.updateById(req.supabase, draftId, updateData);

        return res.status(200).json({
            success: true,
            message: "Interaction updated successfully.",
            data: updatedTurn
        });

    } catch (error) {
        console.error("Update Draft Error:", error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

const createAIDraft = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user.id;
    const files = req.files || [];
    try {
        const { userInput, fileId } = req.body;
        if (!userInput?.trim()) return res.status(400).json({ message: "Input text is required" });
        const file = await File.findById(req.supabase, fileId);
        if (!file) {
            return res.status(404).json({
                success: false,
                message: "Workspace not found"
            });
        }
        if (file.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access to workspace"
            });
        }
        // 1. Storage - Upload attachments to Supabase
        let attachmentUrls = [];
        try {
            attachmentUrls = await supabaseStorage.uploadAttachments(
                files,
                userId,
                fileId
            );
        } catch (storageErr) {
            console.error("🟥[STORAGE] Non-critical Storage Error:", storageErr.message);
        }
        // 2. OCR Service - Extract data from new files
        let ocrInsights = "";
        if (files.length > 0) {
            try {
                console.log(`[OCR Service] Extracting insights from ${files.length} files...`);
                ocrInsights = await OCRService.extractInsights(files);
                console.log("[OCR]", ocrInsights)
            } catch (ocrErr) {
                console.error("🟥[OCR] OCR extraction failed:", ocrErr.message);
                ocrInsights = "Technical error: Could not extract document insights.";
            }
        }
        const imageAttachment = attachmentUrls.find(
            file => file.metadata.mime_type.startsWith("image/")
        ) || null;
        const documentAttachment = attachmentUrls.find(
            file => !file.metadata.mime_type.startsWith("image/")
        ) || null;
        // 3. Context & Metadata Gathering
        let conversationHistory;
        conversationHistory = await ContextService.getRelevantContext(fileId, userInput);
        console.log("--- RAG CONTEXT BEING APPLIED ---");
        console.log(!!conversationHistory || "No relevant embeddings found for this input.");
        console.log("---------------------------------");
        const userProfile = await Profile.findById(req.supabase, userId);
        // 4. Classification & AI Generation
        // const audienceType = classifyAudience(userInput);
        const output_classification = await classifierService
            .classify(userInput)
            .catch(() => ({ type: 'file_note', confidence: 0.4, source: 'fallback' }));
        const detectedType = output_classification.type;
        console.log("[SERVICE]: Output Format Classification", output_classification);
        const extraction = await extractUnifiedContext(userInput, ocrInsights);
        console.log("[AUDIENCE]: ", extraction.recipient_role)
        /// PAYLOAD BUILDER
        const fullPayload = PayloadBuilder.build(file, {
            output_type: detectedType,
            inputText: userInput,
            claim_facts: extraction.facts,
            ocrData: ocrInsights,
            files: files,
            audience: extraction.recipient_role,
            userInfo: {
                sender_name: userProfile.signature_details.name || userProfile.name,
                sender_designation: userProfile.signature_details.designation || userProfile.role,
                sender_email: userProfile.email,
                sender_company: userProfile.signature_details.company || userProfile.company || "AdjusterAssist™"
            }
        });

        const aiRawResponse = await aiService.generateAIDraft(
            detectedType,
            userInput,
            fullPayload,
            conversationHistory,
            extraction.recipient_role,
            userProfile
        );

        const {
            nextAction,
            dynamicSuggestions,
            cleanMainContent
        } = parseAIResponse(aiRawResponse);

        const nextAction2 =
            await generateValidatedNextStep({
                audienceType: extraction.recipient_role,
                userInput,
                payload: fullPayload,
                draftContent: cleanMainContent,
            });
        // 6. Database Operations - Save Main Message Turn
        let turnResult;
        try {
            turnResult = await Message.create(req.supabase, {
                workspace_id: fileId,
                user_id: userId,
                parent_id: null, // Always a parent message
                variant_label: "Original",
                user_input: userInput,
                image_storage_path: imageAttachment?.storagePath || null,
                image_metadata: imageAttachment?.metadata || {},
                document_storage_path: documentAttachment?.storagePath || null,
                document_metadata: documentAttachment?.metadata || {},
                ai_response: cleanMainContent,
                ai_raw_response: aiRawResponse,
                ocr_insights: ocrInsights,
                content_type: detectedType,
                claim_state: file.claim_stage || 'review pending',
                next_step_suggestion: nextAction2,
                quick_actions: dynamicSuggestions,
                activity_type: 'ai_generation',
                metadata: {
                    model: "gpt-4o",
                    output_format: output_classification,
                    audience: extraction.recipient_role,
                    signature: userProfile.is_signature_enabled,
                    payload: fullPayload
                }
            });
            await updateWorkspaceActivity(fileId);
            ContextService.ingestMessage(fileId, turnResult.id, userInput);
            ContextService.ingestMessage(fileId, turnResult.id, aiRawResponse);
            console.log("Message turn Saved with ID: ", turnResult.id);
        } catch (dbErr) {
            console.error("Critical DB Error:", dbErr.message);
            turnResult = { id: Date.now(), created_at: new Date().toISOString() };
        }

        // 7. Secondary Logging & Usage Tracking
        try {
            const { data: logEntry, error: logError } = await supabaseAdmin
                .from('ai_logs')
                .insert([{
                    file_id: parseInt(fileId),
                    user_id: userId,
                    parent_log_id: null,
                    input_text: userInput,
                    input_type: imageAttachment || documentAttachment ? 'attachment+text' : 'text',
                    input_image: imageAttachment?.storagePath || null,
                    documents_url: documentAttachment?.storagePath || null,
                    ocr_insights: ocrInsights,
                    ai_response: aiRawResponse,
                    output_text: cleanMainContent,
                    output_type: detectedType,
                    suggested_next_step: nextAction2,
                    execution_time_ms: Date.now() - startTime,
                    payload: fullPayload,
                    metadata: {
                        model: "gpt-4o",
                        prompt_version: "adjusterassist_v1",
                        is_refinement: false,
                        is_variant: false,
                        output_format: output_classification,
                        audience: extraction.recipient_role,
                        signature: userProfile.is_signature_enabled
                    }
                }])
                .select()
                .single();
            console.log("Log Id:", logEntry.id)

            if (logError) throw logError;
            await deductCredits(userId, 'AI Draft Created', file.claim_number);
        } catch (logErr) {
            console.error("Logging failed:", logErr.message);
        }

        // 8. Success Response
        res.status(200).json({
            success: true,
            data: {
                id: turnResult.id,
                user_input: userInput,
                ai_response: cleanMainContent,
                output_format: detectedType,
                next_step_suggestion: nextAction2,
                quick_actions: dynamicSuggestions,
                attachments: {
                    image: imageAttachment
                        ? {
                            available: true,
                            fileName: imageAttachment.metadata.original_name
                        }
                        : null,

                    document: documentAttachment
                        ? {
                            available: true,
                            fileName: documentAttachment.metadata.original_name
                        }
                        : null
                },
                created_at: turnResult.created_at
            }
        });

    } catch (error) {
        console.error("CRITICAL AI Controller Error:", error);
        res.status(500).json({ success: false, message: "Generation failed" });
    } finally {
        // Cleanup local temp files
        files.forEach(file => {
            if (fs.existsSync(file.path)) {
                try { fs.unlinkSync(file.path); } catch (e) { console.error("Cleanup error:", e); }
            }
        });
    }
};


const createVariantDraft = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user.id;
    try {
        const {
            userInput,
            fileId,
            parentMessageId,
            variantLabel
        } = req.body;
        console.log("[VARIANT] DEBUG BODY:", req.body)

        // 1. Validation - Variant MUST have a parent
        if (!parentMessageId) {
            return res.status(400).json({ message: "Variant generation requires a parentMessageId" });
        }

        // 2. Fetch Parent Context (Inherit OCR and previous data)
        const parentMessage = await Message.findById(req.supabase, parentMessageId);
        if (!parentMessage) {
            return res.status(404).json({ message: "Parent message not found" });
        }

        let conversationHistory;
        conversationHistory = await ContextService.getRelevantContext(fileId, userInput);
        console.log("--- RAG CONTEXT BEING APPLIED ---");
        console.log(!!conversationHistory || "No relevant embeddings found for this input.");
        console.log("---------------------------------");


        const ocrInsights = parentMessage.ocrInsights || "No previous insights.";
        const file = await File.findById(req.supabase, fileId);
        const userProfile = await Profile.findById(req.supabase, userId) || { name: "Adjuster", role: "Field Adjuster" };

        const normalizedLabel = variantLabel.toLowerCase();

        if (normalizedLabel === "email") {
            detectedType = resolveEmailType({
                userInput: userInput,
                originalResponse: parentMessage?.ai_raw_response || ""
            }).type;
        } else {
            const labelMap = {
                "file note": "file_note",
                "attorney response": "attorney_response",
                "xa note": "xactanalysis_response"
            };

            detectedType = labelMap[normalizedLabel] || "file_note";
        }

        // Convert to lowercase once and look it up
        console.log(`[VARIANT]: Transforming content to format: ${detectedType}`);

        const extraction = await extractUnifiedContext(userInput, ocrInsights);
        let audience = extraction.recipient_role
        console.log("[AUDIENCE]: ", audience)

        const fullPayload = await PayloadBuilder.build(file, {
            output_type: detectedType,
            inputText: userInput,
            claim_facts: extraction.facts,
            ocrData: parentMessage.ocrInsights,
            userInfo: {
                sender_name: userProfile.signature_details.name || userProfile.name,
                sender_designation: userProfile.signature_details.designation || userProfile.role,
                sender_email: userProfile.email,
                sender_company: userProfile.signature_details.company || userProfile.company || "AdjusterAssist™"
            },
            files: parentMessage.image_storage_path || parentMessage.document_storage_path,
            audience: audience,
        });

        const transformInstruction = `Convert this to ${variantLabel}`;
        const baseContent = parentMessage.ai_response;

        const combinedInput = `
            INSTRUCTION / TASK: ${transformInstruction}

            CONTENT TO TRANSFORM:
            ${baseContent}
        `;

        inputText: combinedInput
        let prevInput = combinedInput;

        const aiRawResponse = await aiService.generateAIDraft(
            detectedType,
            combinedInput,
            fullPayload,
            conversationHistory,
            audience,
            userProfile
        );

        const {
            nextAction,
            dynamicSuggestions,
            cleanMainContent
        } = parseAIResponse(aiRawResponse);
        const nextAction2 =
            await generateValidatedNextStep({
                audienceType: extraction.recipient_role,
                userInput,
                payload: fullPayload,
                draftContent: cleanMainContent,
            });
        const updateData = {
            ai_response: cleanMainContent,
            ai_raw_response: aiRawResponse,
            content_type: detectedType,
            variant_label: variantLabel,
            version_index: parentMessage.version_index + 1,
            metadata: {
                ...parentMessage.metadata,
                is_variant: true,
                last_modified_at: new Date().toISOString(),
                refined_from_id: parentMessageId,
                output_format: detectedType,
                audience: extraction.recipient_role,
                signature: userProfile.is_signature_enabled
            },
            next_step_suggestion: nextAction2,
            activity_type: 'ai_variant',
            updated_at: new Date().toISOString()
        };
        await updateWorkspaceActivity(fileId);
        const turnResult = await Message.updateById(req.supabase, parentMessageId, updateData);
        await ContextService.ingestMessage(fileId, turnResult.id, aiRawResponse);

        // 8. Log the Variant Action
        await supabaseAdmin.from('ai_logs').insert([{
            file_id: parseInt(fileId),
            user_id: userId,
            parent_log_id: parseInt(parentMessageId),
            variant_label: variantLabel,
            input_text: userInput,
            ai_response: aiRawResponse,
            output_text: cleanMainContent,
            output_type: detectedType,
            ocr_insights: null,
            execution_time_ms: Date.now() - startTime,
            metadata: {
                model: "gpt-4o",
                is_variant: true,
                source_message_id: parentMessageId,
                output_format: detectedType,
                audience: extraction.recipient_role
            },
            payload: fullPayload
        }]);

        await deductCredits(userId, `AI Variant Created to ${variantLabel}`, file.claim_number);

        // 9. Response
        res.status(200).json({
            success: true,
            data: {
                id: turnResult.id,
                parent_id: turnResult.id,
                user_input: userInput,
                variant_label: variantLabel,
                ai_response: cleanMainContent,
                output_format: detectedType,
                next_step_suggestion: nextAction2,
                created_at: new Date().toISOString(),
                updated_at: updateData.updated_at || new Date().toISOString()
            }
        });

    } catch (error) {
        console.error("VARIANT Controller Error:", error);
        res.status(500).json({ success: false, message: "Variant generation failed" });
    }
};

const refineAIDraft = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user.id;

    try {
        const {
            userInput,
            fileId,
            parentMessageId,
            refinementType
        } = req.body;
        console.log("PAYLOAD:", req.body)

        // 1. Validation
        if (!parentMessageId || !refinementType) {
            return res.status(400).json({
                message: "Refinement requires a parentMessageId and a specific refinementType."
            });
        }

        // 2. Fetch Parent Context
        const parentMessage = await Message.findById(req.supabase, parentMessageId);
        if (!parentMessage) {
            return res.status(404).json({ message: "Original message not found." });
        }

        const detectedType = parentMessage.content_type;

        const file = await File.findById(req.supabase, fileId);
        if (!file) return res.status(404).json({ message: "Workspace not found." });


        const extraction = await extractUnifiedContext(
            parentMessage.user_input,
            parentMessage.ocrInsights
        );

        console.log("[AUDIENCE]: ", extraction.recipient_role);

        console.log(`[REFINE]: Applying '${refinementType}' logic to Message ${parentMessageId}`);

        const aiRawResponse = await aiService.refineAIDraft({
            refinementType,
            originalResponse: parentMessage.ai_raw_response,
            audienceType: extraction.recipient_role || "internal"
        });

        const {
            nextAction,
            dynamicSuggestions,
            cleanMainContent
        } = parseAIResponse(aiRawResponse);

        // 7. Save
        const refinementUpdate = {
            ai_response: cleanMainContent,
            ai_raw_response: aiRawResponse,
            refinement_type: refinementType,
            activity_type: 'ai_refinement',
            version_index: parentMessage.version_index + 1,
            next_step_suggestion: nextAction || "Request supporting documentation from the contractor and proceed with inspection to verify the source, scope, and extent of damages",
            metadata: {
                ...parentMessage.metadata,
                last_refinement_action: refinementType,
                is_refinement: true,
                refined_at: new Date().toISOString(),
                previous_version_content: parentMessage.ai_response
            },
            updated_at: new Date().toISOString()
        };

        await updateWorkspaceActivity(fileId);

        const turnResult = await Message.updateById(req.supabase, parentMessageId, refinementUpdate);
        ContextService.ingestMessage(fileId, turnResult.id, aiRawResponse);

        // 8. Log
        await supabaseAdmin.from('ai_logs').insert([{
            file_id: parseInt(fileId),
            user_id: userId,
            parent_log_id: parseInt(parentMessageId),
            refinement_type: refinementType,
            input_text: userInput,
            ai_response: aiRawResponse,
            output_type: parentMessage.content_type,
            execution_time_ms: Date.now() - startTime,
            next_step_suggestion: nextAction || "Request supporting documentation from the contractor and proceed with inspection to verify the source, scope, and extent of damages",
            metadata: { is_refinement: true, action: refinementType, model: "gpt-4o" },
            // payload: fullPayload
        }]);

        await deductCredits(userId, `AI draft refined to ${refinementType}`, file.claim_number);


        // 9. Response
        res.status(200).json({
            success: true,
            data: {
                id: parentMessageId,
                parent_id: parentMessage.parent_id || parentMessageId,
                user_input: parentMessage.userInput,
                refinement_type: turnResult.refinement_type,
                ai_response: cleanMainContent,
                output_format: detectedType,
                next_step_suggestion: refinementUpdate.next_step_suggestion,
                created_at: turnResult.created_at,
                updated_at: refinementUpdate.updated_at
            }
        });

    } catch (error) {
        console.error("REFINEMENT Controller Error:", error);
        res.status(500).json({ success: false, message: "Refinement failed." });
    }
};


const getAttachmentPreview = async (req, res) => {
    try {
        const { messageId, type } = req.params;
        const userId = req.user.id;

        // 1. Fetch message
        const message = await Message.findById(
            req.supabase,
            messageId
        );

        if (!message) {
            return res.status(404).json({
                success: false,
                message: "Message not found"
            });
        }

        // 2. Ownership validation
        if (message.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized"
            });
        }

        // 3. Resolve path internally
        let storagePath = null;

        if (type === "image") {
            storagePath = message.image_storage_path;
        }

        if (type === "document") {
            storagePath = message.document_storage_path;
        }

        if (!storagePath) {
            return res.status(404).json({
                success: false,
                message: "Attachment not found"
            });
        }

        // 4. Generate temporary signed URL
        const { data, error } =
            await supabaseAdmin.storage
                .from("claims-attachments")
                .createSignedUrl(
                    storagePath,
                    60 * 5 // 2 minutes
                );

        if (error) throw error;

        // 5. Return temporary URL
        return res.status(200).json({
            success: true,
            signedUrl: data.signedUrl
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Preview generation failed"
        });
    }
};

module.exports = {
    testCreateMessage,
    getFileDrafts,
    getRecentDrafts,
    deleteDraft,
    createAIDraft,
    AllDrafts,
    updateDraft,

    createVariantDraft,
    refineAIDraft,
    getAttachmentPreview
};