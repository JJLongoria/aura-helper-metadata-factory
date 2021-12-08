import { CoreUtils, FileChecker, FileReader, GitDiff, MetadataDetail, MetadataItem, MetadataObject, MetadataSuffixByType, MetadataType, MetadataTypes, NotIncludedMetadata, PathUtils, PicklistValue, ProjectConfig, RecordType, SObject, SObjectField, TypesFromGit, WrongDatatypeException, WrongFormatException } from '@aurahelper/core';
import { XML } from '@aurahelper/languages';

const XMLUtils = XML.XMLUtils;
const XMLParser = XML.XMLParser;
const Utils = CoreUtils.Utils;
const StrUtils = CoreUtils.StrUtils;
const Validator = CoreUtils.Validator;
const ProjectUtils = CoreUtils.ProjectUtils;
const MetadataUtils = CoreUtils.MetadataUtils;

const UNFILED_PUBLIC_FOLDER = 'unfiled$public';

const METADATA_XML_RELATION: any = {
    Workflow: {
        outboundMessages: {
            fieldKey: 'fullName',
            type: MetadataTypes.WORKFLOW_OUTBOUND_MESSAGE
        },
        knowledgePublishes: {
            fieldKey: 'fullName',
            type: MetadataTypes.WORKFLOW_KNOWLEDGE_PUBLISH
        },
        tasks: {
            fieldKey: 'fullName',
            type: MetadataTypes.WORKFLOW_TASK
        },
        rules: {
            fieldKey: 'fullName',
            type: MetadataTypes.WORKFLOW_RULE
        },
        fieldUpdates: {
            fieldKey: 'fullName',
            type: MetadataTypes.WORKFLOW_FIELD_UPDATE
        },
        alerts: {
            fieldKey: 'fullName',
            type: MetadataTypes.WORKFLOW_ALERT
        }
    },
    SharingRules: {
        sharingCriteriaRules: {
            fieldKey: 'fullName',
            type: MetadataTypes.SHARING_CRITERIA_RULE
        },
        sharingOwnerRules: {
            fieldKey: 'fullName',
            type: MetadataTypes.SHARING_OWNER_RULE
        },
        sharingGuestRules: {
            fieldKey: 'fullName',
            type: MetadataTypes.SHARING_GUEST_RULE
        },
        sharingTerritoryRules: {
            fieldKey: 'fullName',
            type: MetadataTypes.SHARING_TERRITORY_RULE
        }
    },
    AssignmentRules: {
        assignmentRule: {
            fieldKey: 'fullName',
            type: MetadataTypes.ASSIGNMENT_RULE
        }
    },
    AutoResponseRules: {
        autoresponseRule: {
            fieldKey: 'fullName',
            type: MetadataTypes.AUTORESPONSE_RULE
        }
    },
    EscalationRules: {
        escalationRule: {
            fieldKey: 'fullName',
            type: MetadataTypes.ESCALATION_RULE
        }
    },
    MatchingRules: {
        matchingRules: {
            fieldKey: 'fullName',
            type: MetadataTypes.MATCHING_RULE
        }
    },
    CustomLabels: {
        labels: {
            fieldKey: 'fullName',
            type: MetadataTypes.CUSTOM_LABEL
        }
    }
};

/**
 * Class with several util methods to create the Aura Helper Metadata JSON from several sources like queries result, file system, git... or work with other SObject or Metadata object types like MetadataDetails, MetadataFolderMap or SOjects collections.
 */
export class MetadataFactory {

    /**
     * Method to create the MeadataDetails objects collection from SFDX describe metadata types used in Aura Helper Connector. Can process the response directly or process a file with the response content
     * @param {string | any} responseOrPath SFDX string response or JSON response or path to the file with the response data 
     * 
     * @returns {MetadataDetail[]} Array with the MetadataDetails for all metadata types received on the response
     * 
     * @throws {WrongFilePathException} If the path is not a string or cant convert to absolute path
     * @throws {FileNotFoundException} If the file not exists or not have access to it
     * @throws {InvalidFilePathException} If the path is not a file
     * @throws {WrongFormatException} If file is not a JSON file or the string response is not a JSON
     */
    static createMetadataDetails(responseOrPath: string | any): MetadataDetail[] {
        let metadataTypes: any;
        if (Utils.isArray(responseOrPath)) {
            metadataTypes = responseOrPath;
        } else if (Utils.isString(responseOrPath)) {
            try {
                metadataTypes = JSON.parse(responseOrPath);
            } catch (errorParse) {
                try {
                    metadataTypes = Validator.validateJSONFile(responseOrPath);
                } catch (error) {
                    const err = error as Error;
                    if (err.name === 'WrongFormatException') {
                        err.message = 'The provided string response is not a JSON or file path';
                    }
                    throw err;
                }
            }
        }
        if (!metadataTypes) {
            return [];
        }
        if (metadataTypes.status === 0 && metadataTypes.result.metadataObjects) {
            metadataTypes = metadataTypes.result.metadataObjects;
        }
        const metadataDetails = [];
        if (metadataTypes !== undefined) {
            metadataTypes = Utils.forceArray(metadataTypes);
            for (const metadata of metadataTypes) {
                metadataDetails.push(new MetadataDetail(metadata.xmlName, metadata.directoryName, metadata.suffix, metadata.inFolder, metadata.metaFile));
                if (metadata.childXmlNames && metadata.childXmlNames.length > 0) {
                    for (const childXMLName of metadata.childXmlNames) {
                        let suffix = (MetadataSuffixByType[childXMLName]) ? MetadataSuffixByType[childXMLName] : metadata.suffix;
                        metadataDetails.push(new MetadataDetail(childXMLName, metadata.directoryName, suffix, metadata.inFolder, metadata.metaFile));
                    }
                }
            }
        }
        return metadataDetails;
    }

    /**
     * Method to create Metadata Types JSON data from the results of a query (Used to create types from Reports, Dashboards, EmailTemplates...). Used in Aura Helper Connector to process the responses
     * @param {string} metadataTypeName Metadata Type API Name
     * @param {any[]} records List of records to create the Metadata Types
     * @param {any} foldersByType Object with the objects folders (email folders, document folders...) related by Metadata Type
     * @param {string} namespacePrefix Namespace prefix from the org
     * @param {boolean} [addAll] true to add all elements in records list, false to add only your org namespace objects
     * 
     * @returns {MetadataType} Return a Metadata Type Object with the records data
     */
    static createMetadataTypeFromRecords(metadataTypeName: string, records: any[], foldersByType: any, namespacePrefix: string, addAll?: boolean): MetadataType {
        const metadataType = new MetadataType(metadataTypeName);
        for (const record of records) {
            const folderDevName = getFolderDeveloperName(foldersByType[metadataTypeName], (record.FolderId || record.FolderName), metadataTypeName !== MetadataTypes.REPORT);
            if (folderDevName === undefined) {
                continue;
            }
            if (addAll || (!record.NamespacePrefix || record.NamespacePrefix === namespacePrefix)) {
                metadataType.addChild(folderDevName, new MetadataObject(folderDevName));
                metadataType.getChild(folderDevName)!.addChild(record.DeveloperName, new MetadataItem(record.DeveloperName));
            }
        }
        return metadataType;
    }

    /**
     * Method to create the Metadata Types from SFDX Command. Used in Aura Helper Connector to process the responses
     * @param {string} metadataTypeName Metadata Type API Name
     * @param {string | any} response string response or JSON response from SFDX command
     * @param {string} namespacePrefix Namespace prefix from the org
     * @param {boolean} [addAll] true to add all elements in response, false to add only your org namespace objects
     * @param {boolean} [groupGlobalActions] True to group global quick actions on "GlobalActions" group, false to include as object and item.
     * 
     * @returns {MetadataType | undefined} Return a Metadata Type Object with the response data
     * 
     * @throws {WrongFormatException} If the response is not a JSON string or JSON Object
     */
    static createMetedataTypeFromResponse(metadataTypeName: string, response: string | any, namespacePrefix: string, addAll?: boolean, groupGlobalActions?: boolean): MetadataType | undefined {
        let metadataType;
        if (!response) {
            return metadataType;
        }
        if (Utils.isString(response)) {
            try {
                response = JSON.parse(response);
            } catch (error) {
                throw new WrongFormatException('The provided string response is not a JSON');
            }
        } else if (!Utils.isObject(response)) {
            throw new WrongFormatException('The provided response is not a JSON string or JSON Object');
        }
        if (response.status === 0) {
            let dataList = Utils.forceArray(response.result);
            if (dataList === undefined) {
                return undefined;
            }
            metadataType = new MetadataType(metadataTypeName);
            createMetadataObjectsFromArray(metadataType, dataList, addAll, namespacePrefix, false, groupGlobalActions);
        }
        return metadataType;
    }

    /**
     * Method to create not included Metadata Types into the responses of SFDX Commands like StandardValueSet for Standard Picklist values
     * @param {string} metadataTypeName Metadata Type API Name
     * 
     * @returns {MetadataType | undefined} Return the selected Metadata Type with childs data or undefined if not exists on not selected metadata types
     */
    static createNotIncludedMetadataType(metadataTypeName: string): MetadataType | undefined {
        if (NotIncludedMetadata[metadataTypeName]) {
            const metadataType = new MetadataType(metadataTypeName);
            for (const element of NotIncludedMetadata[metadataTypeName].elements) {
                metadataType.addChild(new MetadataObject(element));
            }
            return metadataType;
        }
        return undefined;
    }

    /**
     * Method to create a SObject instance from the response of describe SObjects command from SFDX
     * @param {string} strJson string JSON response
     * 
     * @returns {SObject | undefined} Return an instance of the SObject or undefined if cant extract the data 
     */
    static createSObjectFromJSONSchema(strJson: string): SObject | undefined {
        let isOnFields = false;
        let isOnRts = false;
        let isOnReference = false;
        let isOnPicklistVal = false;
        let bracketIndent = 0;
        let sObject = new SObject();
        let field = new SObjectField();
        let pickVal = new PicklistValue();
        let rt = new RecordType();
        for (let line of strJson.split('\n')) {
            line = line.trim();
            if (line.indexOf('{') !== -1) {
                bracketIndent++;
            } else if (line.indexOf('}') !== -1) {
                bracketIndent--;
                if (isOnRts) {
                    if (rt.developerName) {
                        sObject.addRecordType(rt.developerName, rt);
                    }
                    rt = new RecordType();
                }
                if (isOnPicklistVal) {
                    if (pickVal.value) {
                        field.addPicklistValue(pickVal);
                    }
                    pickVal = new PicklistValue();
                }
                else if (isOnFields) {
                    if (field.name) {
                        sObject.addField(field.name, field);
                    }
                    field = new SObjectField();
                }
            }
            if (bracketIndent === 2) {
                if (line.indexOf('fields') !== -1 && line.indexOf(':') !== -1 && line.indexOf('[') !== -1) {
                    isOnFields = true;
                }
                if (isOnFields && line.indexOf(']') !== -1 && line.indexOf('[') === -1) {
                    isOnFields = false;
                    isOnReference = false;
                    isOnPicklistVal = false;
                    if (field.name) {
                        sObject.addField(field.name, field);
                    }
                    field = new SObjectField();
                }

                if (line.indexOf('recordTypeInfos') !== -1 && line.indexOf(':') !== -1 && line.indexOf('[') !== -1) {
                    isOnRts = true;
                }
                if (isOnRts && line.indexOf(']') !== -1 && line.indexOf('[') === -1) {
                    isOnRts = false;
                    if (rt.developerName) {
                        sObject.addRecordType(rt.developerName, rt);
                    }
                    rt = new RecordType();
                }
            }
            if (isOnReference && line.indexOf(']') !== -1) {
                isOnReference = false;
            }
            if (isOnPicklistVal && line.indexOf(']') !== -1) {
                isOnPicklistVal = false;
            }
            if (bracketIndent === 2 && !isOnFields && !isOnRts) {
                let keyValue = getJSONNameValuePair(line);
                if (keyValue.name === 'name') {
                    sObject.setName(keyValue.value);
                }
                if (keyValue.name === 'label') {
                    sObject.setLabel(keyValue.value);
                }
                if (keyValue.name === 'labelPlural') {
                    sObject.setLabelPlural(keyValue.value);
                }
                if (keyValue.name === 'keyPrefix') {
                    sObject.setKeyPrefix(keyValue.value);
                }
                if (keyValue.name === 'queryable') {
                    sObject.setQueryable(keyValue.value);
                }
                if (keyValue.name === 'custom') {
                    sObject.setCustom(keyValue.value === 'true');
                }
                if (keyValue.name === 'description') {
                    sObject.description = keyValue.value;
                }
                if (keyValue.name === 'customSetting') {
                    sObject.setCustomSetting(keyValue.value === 'true');
                }
            } else if (isOnReference && line.indexOf('[') === -1) {
                field.addReferenceTo(StrUtils.replace(line, '"', '').trim());
            } else if (isOnPicklistVal && line.indexOf('[') === -1) {
                let keyValue = getJSONNameValuePair(line);
                if (keyValue.name === 'active') {
                    pickVal.setActive(keyValue.value === 'true');
                }
                if (keyValue.name === 'defaultValue') {
                    pickVal.setDefaultValue(keyValue.value === 'true');
                }
                if (keyValue.name === 'label') {
                    pickVal.setLabel(keyValue.value);
                }
                if (keyValue.name === 'value') {
                    pickVal.setValue(keyValue.value);
                }
            } else if (isOnFields && !isOnPicklistVal && !isOnReference) {
                if (bracketIndent === 3) {
                    let keyValue = getJSONNameValuePair(line);
                    if (keyValue.name === 'name') {
                        field.setName(keyValue.value);
                    }
                    if (keyValue.name === 'label') {
                        field.setLabel(keyValue.value);
                    }
                    if (keyValue.name === 'description') {
                        field.description = keyValue.value;
                    }
                    if (keyValue.name === 'inlineHelpText') {
                        field.inlineHelpText = keyValue.value;
                    }
                    if (keyValue.name === 'type') {
                        field.setType(keyValue.value);
                    }
                    if (keyValue.name === 'length') {
                        field.setLenght(keyValue.value);
                    }
                    if (keyValue.name === 'custom') {
                        field.setCustom(keyValue.value === 'true');
                    }
                    if (keyValue.name === 'nillable') {
                        field.setNillable(keyValue.value === 'true');
                    }
                    if (keyValue.name === 'relationshipName' && keyValue.value !== 'null') {
                        field.setRelationshipName(keyValue.value);
                    }
                    if (keyValue.name === "referenceTo" && line.indexOf(']') === -1) {
                        isOnReference = true;
                        isOnPicklistVal = false;
                    }
                    if (keyValue.name === "picklistValues" && line.indexOf(']') === -1) {
                        isOnPicklistVal = true;
                        isOnReference = false;
                    }
                }
            } else if (isOnRts) {
                if (bracketIndent === 3) {
                    let keyValue = getJSONNameValuePair(line);
                    if (keyValue.name === 'name') {
                        rt.setName(keyValue.value);
                    }
                    if (keyValue.name === 'developerName') {
                        rt.setDeveloperName(keyValue.value);
                    }
                    if (keyValue.name === 'defaultRecordTypeMapping') {
                        rt.setDefault(keyValue.value === 'true');
                    }
                    if (keyValue.name === 'master') {
                        rt.setDefault(keyValue.value === 'true');
                    }
                }
            }
        }
        if (!sObject.name) {
            return undefined;
        }
        sObject.addSystemFields();
        sObject.fixFieldTypes();
        return sObject;
    }

    /**
     * Method to extract the SObjects data from the file system into an object with the SObject API Names in lower case as keys, and the SObject instance as value
     * @param {string} sObjectsPath Path to the SObjects folder
     * 
     * @returns {{ [key: string]: SObject }} Return an Object with the stored SObjects data with the name in lower case as key, and the SObject instance as value
     * 
     * @throws {WrongDirectoryPathException} If the sObjects path is not a string or can't convert to absolute path
     * @throws {DirectoryNotFoundException} If the directory not exists or not have access to it
     * @throws {InvalidDirectoryPathException} If the path is not a directory
     */
    static createSObjectsFromFileSystem(sObjectsPath: string): { [key: string]: SObject } {
        const sObjects: { [key: string]: SObject } = {};
        sObjectsPath = Validator.validateFolderPath(sObjectsPath);
        const folders = FileReader.readDirSync(sObjectsPath);
        for (const folder of folders) {
            const newObject = new SObject(folder);
            newObject.custom = folder.endsWith('__c');
            newObject.customSetting = false;
            newObject.label = folder;
            newObject.labelPlural = folder;
            newObject.namespace = MetadataUtils.getNamespaceFromName(folder);
            newObject.queryable = true;
            const objFile = sObjectsPath + '/' + folder + '/' + folder + '.object-meta.xml';
            const fieldsFolder = sObjectsPath + '/' + folder + '/fields';
            const recordTypesFolder = sObjectsPath + '/' + folder + '/recordTypes';
            if (FileChecker.isExists(objFile)) {
                const xmlObj = XMLParser.parseXML(FileReader.readFileSync(objFile));
                newObject.label = !Utils.isNull(xmlObj.label) ? xmlObj.label : newObject.label;
                newObject.labelPlural = !Utils.isNull(xmlObj.labelPlural) ? xmlObj.labelPlural : newObject.labelPlural;
                newObject.namespace = !Utils.isNull(xmlObj.namespace) ? xmlObj.namespace : newObject.namespace;
                newObject.customSetting = !Utils.isNull(xmlObj.customSettingsType);
                newObject.description = !Utils.isNull(xmlObj.description) ? xmlObj.description : newObject.description;
            }
            if (FileChecker.isExists(fieldsFolder)) {
                const fields = FileReader.readDirSync(fieldsFolder);
                for (const field of fields) {
                    const xmlRoot = XMLParser.parseXML(FileReader.readFileSync(fieldsFolder + '/' + field));
                    const xmlField = xmlRoot['CustomField'];
                    const objField = new SObjectField(xmlField.fullName || StrUtils.replace(field, '.field-meta.xml', ''));
                    objField.label = !Utils.isNull(xmlField.label) ? xmlField.label : objField.name;
                    objField.custom = objField.name.endsWith('__c');
                    objField.length = !Utils.isNull(xmlField.length) ? xmlField.length : undefined;
                    objField.description = !Utils.isNull(xmlField.description) ? xmlField.description : objField.description;
                    objField.inlineHelpText = !Utils.isNull(xmlField.inlineHelpText) ? xmlField.inlineHelpText : objField.inlineHelpText;
                    objField.namespace = MetadataUtils.getNamespaceFromName(objField.name);
                    objField.nillable = !Utils.isNull(xmlField.nillable) ? xmlField.nillable : true;
                    objField.referenceTo = !Utils.isNull(xmlField.referenceTo) ? Utils.forceArray(xmlField.referenceTo) : objField.referenceTo;
                    objField.relationshipName = objField.name.endsWith('Id') ? objField.name.substring(0, objField.name.length - 2) : objField.relationshipName;
                    objField.relationshipName = objField.name.endsWith('__c') ? objField.name.substring(0, objField.name.length - 3) + '__r' : objField.relationshipName;
                    objField.type = !Utils.isNull(xmlField.type) ? xmlField.type : objField.type;
                    if (!Utils.isNull(xmlField.valueSet) && !Utils.isNull(xmlField.valueSet.valueSetDefinition)) {
                        const values = XMLUtils.forceArray(xmlField.valueSet.valueSetDefinition.value);
                        for (const value of values) {
                            const pickVal = new PicklistValue();
                            pickVal.active = !Utils.isNull(value.isActive) ? value.isActive : true;
                            pickVal.defaultValue = !Utils.isNull(value.default) ? value.default : false;
                            pickVal.value = !Utils.isNull(value.fullName) ? value.fullName : undefined;
                            pickVal.label = !Utils.isNull(value.label) ? value.label : undefined;
                            objField.addPicklistValue(pickVal);
                        }
                    }

                    if (objField && objField.name) {
                        newObject.addField(objField.name.toLowerCase(), objField);
                    }
                }
            }
            if (FileChecker.isExists(recordTypesFolder)) {
                const recordTypes = FileReader.readDirSync(recordTypesFolder);
                for (const recordType of recordTypes) {
                    const xmlRoot = XMLParser.parseXML(FileReader.readFileSync(recordTypesFolder + '/' + recordType));
                    const xmlRT = xmlRoot['RecordType'];
                    const objRT = new RecordType(xmlRT.fullName);
                    objRT.developerName = xmlRT.fullName;
                    objRT.name = !Utils.isNull(xmlRT.label) ? xmlRT.label : undefined;
                    if (objRT && objRT.developerName) {
                        newObject.addRecordType(objRT.developerName.toLowerCase(), objRT);
                    }
                }
            }
            newObject.addSystemFields();
            sObjects[newObject.name.toLowerCase()] = newObject;
        }
        return sObjects;
    }

    /**
     * Method to create a Map to relate the directory name to the related Metadata Detail. Including subtypes like SObejct fields, indexses...
     * @param {MetadataDetail[]} metadataDetails Metadata details list to create the Metadata Folder map
     * 
     * @returns {{ [key: string]: MetadataDetail }} Return an object with the directory name as key, and Metadata Detail as value
     */
    static createFolderMetadataMap(metadataDetails: MetadataDetail[]): { [key: string]: MetadataDetail } {
        const folderMetadataMap: { [key: string]: MetadataDetail } = {};
        for (const metadataDetail of metadataDetails) {
            if (metadataDetail.xmlName === MetadataTypes.CUSTOM_FIELD) {
                folderMetadataMap[metadataDetail.directoryName + '/fields'] = metadataDetail;
            } else if (metadataDetail.xmlName === MetadataTypes.INDEX) {
                folderMetadataMap[metadataDetail.directoryName + '/indexes'] = metadataDetail;
            } else if (metadataDetail.xmlName === MetadataTypes.BUSINESS_PROCESS) {
                folderMetadataMap[metadataDetail.directoryName + '/businessProcesses'] = metadataDetail;
            } else if (metadataDetail.xmlName === MetadataTypes.COMPACT_LAYOUT) {
                folderMetadataMap[metadataDetail.directoryName + '/compactLayouts'] = metadataDetail;
            } else if (metadataDetail.xmlName === MetadataTypes.RECORD_TYPE) {
                folderMetadataMap[metadataDetail.directoryName + '/recordTypes'] = metadataDetail;
            } else if (metadataDetail.xmlName === MetadataTypes.WEBLINK) {
                folderMetadataMap[metadataDetail.directoryName + '/webLinks'] = metadataDetail;
            } else if (metadataDetail.xmlName === MetadataTypes.VALIDATION_RULE) {
                folderMetadataMap[metadataDetail.directoryName + '/validationRules'] = metadataDetail;
            } else if (metadataDetail.xmlName === MetadataTypes.SHARING_REASON) {
                folderMetadataMap[metadataDetail.directoryName + '/sharingReasons'] = metadataDetail;
            } else if (metadataDetail.xmlName === MetadataTypes.LISTVIEW) {
                folderMetadataMap[metadataDetail.directoryName + '/listViews'] = metadataDetail;
            } else if (metadataDetail.xmlName === MetadataTypes.FIELD_SET) {
                folderMetadataMap[metadataDetail.directoryName + '/fieldSets'] = metadataDetail;
            } else if (metadataDetail.directoryName && !folderMetadataMap[metadataDetail.directoryName]) {
                folderMetadataMap[metadataDetail.directoryName] = metadataDetail;
            }
        }
        return folderMetadataMap;
    }

    /**
     * Method to create the Metadata JSON Object with the files and data from your local project.
     * @param {{ [key: string]: MetadataDetail } | MetadataDetail[]} folderMapOrDetails Folder metadata map created with createFolderMetadataMap() method or MetadataDetails created with createMetadataDetails() method or downloaded with aura Helper Connector
     * @param {string} root Path to the Salesforce project root
     * @param {boolean} [groupGlobalActions] True to group global quick actions on "GlobalActions" group, false to include as object and item.
     * 
     * @returns {{ [key: string]: MetadataType }} Returns a Metadata JSON Object with the data from the local project
     * 
     * @throws {WrongDirectoryPathException} If the root path is not a string or can't convert to absolute path
     * @throws {DirectoryNotFoundException} If the directory not exists or not have access to it
     * @throws {InvalidDirectoryPathException} If the path is not a directory
     */
    static createMetadataTypesFromFileSystem(folderMapOrDetails: { [key: string]: MetadataDetail } | MetadataDetail[], root: string, groupGlobalActions?: boolean): { [key: string]: MetadataType } {
        let metadata: { [key: string]: MetadataType } = {};
        let folderMetadataMap;
        root = Validator.validateFolderPath(root);
        if (Array.isArray(folderMapOrDetails)) {
            folderMetadataMap = MetadataFactory.createFolderMetadataMap(folderMapOrDetails);
        } else {
            folderMetadataMap = folderMapOrDetails;
        }
        let projectConfig = ProjectUtils.getProjectConfig(root);
        if (projectConfig === undefined) {
            projectConfig = new ProjectConfig('');
            projectConfig.packageDirectories[0] = { path: root, default: true };
        }
        for (const packageDirectory of projectConfig.packageDirectories) {
            let directory = packageDirectory.path;
            if (packageDirectory.path !== root) {
                directory = root + '/' + packageDirectory.path + '/main/default';
            }
            if (!FileChecker.isExists(directory)) {
                continue;
            }
            let folders = FileReader.readDirSync(directory);
            for (const folder of folders) {
                let metadataType = folderMetadataMap[folder];
                if (metadataType) {
                    let folderPath = directory + '/' + folder;
                    if (folder === 'objects') {
                        metadata = getCustomObjectsMetadata(metadata, folderPath);
                    } else if (folder === 'approvalProcesses') {
                        metadata[metadataType.xmlName] = getMetadataFromFolders(folderPath, metadataType, '.');
                    } else if (folder === 'customMetadata') {
                        metadata[metadataType.xmlName] = getMetadataFromFolders(folderPath, metadataType, '.');
                    } else if (folder === 'dashboards') {
                        metadata[metadataType.xmlName] = getDashboardsMetadataFromFolder(folderPath, metadataType);
                    } else if (folder === 'documents') {
                        metadata[metadataType.xmlName] = getDocumentsMetadataFromFolder(folderPath, metadataType);
                    } else if (folder === 'duplicateRules') {
                        metadata[metadataType.xmlName] = getMetadataFromFolders(folderPath, metadataType, '.');
                    } else if (folder === 'email') {
                        metadata[metadataType.xmlName] = getEmailTemplateMetadataFromFolder(folderPath, metadataType);
                    } else if (folder === 'flows') {
                        metadata[metadataType.xmlName] = getFlowsMetadataFromFolder(folderPath, metadataType);
                    } else if (folder === 'layouts') {
                        metadata[metadataType.xmlName] = getLayoutsMetadataFromFolder(folderPath, metadataType);
                    } else if (folder === 'objectTranslations') {
                        metadata[metadataType.xmlName] = getMetadataFromFolders(folderPath, metadataType, '-');
                    } else if (folder === 'reports') {
                        metadata[metadataType.xmlName] = getReportsMetadataFromFolder(folderPath, metadataType);
                    } else if (folder === 'quickActions') {
                        metadata[metadataType.xmlName] = getMetadataFromFolders(folderPath, metadataType, '.', (groupGlobalActions) ? 'GlobalActions' : undefined);
                    } else if (folder === 'standardValueSetTranslations') {
                        metadata[metadataType.xmlName] = getStandardValueSetTranslationMetadataFromFolder(folderPath, metadataType);
                    } else if (folder === 'lwc') {
                        let newMetadata = new MetadataType(metadataType.xmlName, false, folderPath, metadataType.suffix);
                        const objs = getMetadataObjects(folderPath, true);
                        newMetadata.childs = objs || {};
                        if (newMetadata.childs && Object.keys(newMetadata.childs).length > 0) {
                            metadata[metadataType.xmlName] = newMetadata;
                        }
                    } else if (folder === 'aura') {
                        let newMetadata = new MetadataType(metadataType.xmlName, false, folderPath, metadataType.suffix);
                        const objs = getMetadataObjects(folderPath, true);
                        newMetadata.childs = objs || {};
                        if (newMetadata.childs && Object.keys(newMetadata.childs).length > 0) {
                            metadata[metadataType.xmlName] = newMetadata;
                        }
                    } else if (METADATA_XML_RELATION[metadataType.xmlName]) {
                        getMetadataFromFiles(metadataType, metadata, folderPath);
                    } else {
                        let newMetadata = new MetadataType(metadataType.xmlName, false, folderPath, metadataType.suffix);
                        let childs = getMetadataObjects(folderPath);
                        if (childs && Object.keys(childs).length > 0) {
                            newMetadata.childs = childs;
                            metadata[metadataType.xmlName] = newMetadata;
                        }
                    }
                }
            }
        }
        metadata = MetadataUtils.orderMetadata(metadata);
        return metadata;
    }

    /**
     * Method to create the Metadata JSON Object from a package XML file
     * @param {string | any} pathOrContent Path to the package file or XML string content or XML Parsed content (XMLParser)
     * @param {boolean} [groupGlobalActions] True to group global quick actions on "GlobalActions" group, false to include as object and item.
     * 
     * @returns {{ [key: string]: MetadataType }} Return a Metadata JSON Object with the package data
     * 
     * @throws {WrongDirectoryPathException} If the path is not a string or can't convert to absolute path
     * @throws {DirectoryNotFoundException} If the directory not exists or not have access to it
     * @throws {InvalidDirectoryPathException} If the path is not a directory
     * @throws {WrongDatatypeException} If the parameter is not an string or valid XML Object parsed with XMLParser
     * @throws {WrongFormatException} If the provided data is not a correct Package XML file
     */
    static createMetadataTypesFromPackageXML(pathOrContent: string | any, groupGlobalActions?: boolean): { [key: string]: MetadataType } {
        const metadataTypes: { [key: string]: MetadataType } = {};
        if (!pathOrContent) {
            return metadataTypes;
        }
        let xmlRoot = pathOrContent;
        if (Utils.isString(pathOrContent)) {
            try {
                try {
                    xmlRoot = XMLParser.parseXML(FileReader.readFileSync(Validator.validateFilePath(pathOrContent)));
                } catch (error) {
                    xmlRoot = XMLParser.parseXML(pathOrContent);
                }
            } catch (error) {
                throw new WrongDatatypeException('Wrong data parameter. Expect a package file path, XML Parsed content or XML string content but receive ' + pathOrContent);
            }
        } else if (!Utils.isObject(pathOrContent)) {
            throw new WrongDatatypeException('Wrong data parameter. Expect a package file path, XML Parsed content or XML string content but receive ' + pathOrContent);
        }
        if (!xmlRoot.Package && !xmlRoot.prepared) {
            throw new WrongFormatException('Not a valid package.xml content. Check the file format');
        }
        const preparedPackage = preparePackageFromXML(xmlRoot);
        for (const typeName of Object.keys(preparedPackage)) {
            if (typeName !== 'version' && typeName !== 'prepared') {
                let metadataType = new MetadataType(typeName);
                metadataType.checked = preparedPackage[typeName].includes('*');
                metadataType = createMetadataObjectsFromArray(metadataType, preparedPackage[typeName], true, undefined, true, groupGlobalActions);
                metadataTypes[typeName] = metadataType;
            }
        }
        return metadataTypes;
    }

    /**
     * Method to create the Metadata JSON Object from the Git Diffs to able to create a Package from a git differences automatically and deploy it
     * @param {string} root Path to the Project Root
     * @param {GitDiff[]} gitDiffs List of git diffs extracted with Aura Helper Git Manager Module
     * @param {{ [key: string]: MetadataDetail } | MetadataDetail[]} folderMapOrDetails Folder metadata map created with createFolderMetadataMap() method or MetadataDetails created with createMetadataDetails() method or downloaded with aura Helper Connector
     * @param {boolean} [groupGlobalActions] True to group global quick actions on "GlobalActions" group, false to include as object and item.
     * 
     * @returns {TypesFromGit} Returns a Metadata JSON Object extracted from Git diffs 
     */
    static createMetadataTypesFromGitDiffs(root: string, gitDiffs: GitDiff[], folderMapOrDetails: { [key: string]: MetadataDetail } | MetadataDetail[], groupGlobalActions?: boolean): TypesFromGit {
        let metadataRootFolder = root + '/force-app/main/default';
        let metadataForDeploy: { [key: string]: MetadataType } = {};
        let metadataForDelete: { [key: string]: MetadataType } = {};
        let folderMetadataMap;
        if (Array.isArray(folderMapOrDetails)) {
            folderMetadataMap = MetadataFactory.createFolderMetadataMap(folderMapOrDetails);
        } else {
            folderMetadataMap = folderMapOrDetails;
        }
        for (const diff of gitDiffs) {
            let typeFolder = '';
            let filePath = '';
            let baseFolder = StrUtils.replace(PathUtils.getDirname(root + '/' + diff.path), ',', '');
            let fileNameWithExt = PathUtils.getBasename(diff.path);
            baseFolder = baseFolder.replace(metadataRootFolder + '/', '');
            let baseFolderSplits = baseFolder.split('/');
            let fistPartBaseFolder = baseFolderSplits[0];
            let lastPartFolder = baseFolderSplits[baseFolderSplits.length - 1];
            let metadataType;
            if (fistPartBaseFolder === 'lwc' && StrUtils.contains(fileNameWithExt, 'eslintrc.json')) {
                continue;
            }
            if (fistPartBaseFolder === 'objects') {
                metadataType = folderMetadataMap[fistPartBaseFolder + '/' + lastPartFolder];
            } else {
                metadataType = folderMetadataMap[baseFolder];
            }
            if (!metadataType) {
                metadataType = folderMetadataMap[fistPartBaseFolder];
            }
            if (!metadataType) {
                continue;
            }
            typeFolder = metadataRootFolder + '/' + metadataType.directoryName;
            filePath = root + '/' + diff.path;
            let fileName;
            if (metadataType.xmlName !== MetadataTypes.DOCUMENT && fileNameWithExt.indexOf('Folder-meta.xml') === -1) {
                fileName = StrUtils.replace(fileNameWithExt, '-meta.xml', '');
                fileName = fileName.substring(0, fileName.lastIndexOf('.'));
            } else {
                fileName = fileNameWithExt;
            }
            if (diff.mode === 'new file' || diff.mode === 'edit file') {
                if (METADATA_XML_RELATION[metadataType.xmlName]) {
                    let possibleMetadataToAddOnDeploy = analizeDiffChanges(diff.addChanges, metadataForDeploy, metadataType, fileName, filePath);
                    let possibleMetadataToAddOnDelete = analizeDiffChanges(diff.removeChanges, metadataForDelete, metadataType, fileName, filePath);
                    if (possibleMetadataToAddOnDeploy) {
                        metadataForDeploy = MetadataUtils.combineMetadata(metadataForDeploy, possibleMetadataToAddOnDeploy);
                    }
                    if (possibleMetadataToAddOnDelete) {
                        metadataForDelete = MetadataUtils.combineMetadata(metadataForDelete, possibleMetadataToAddOnDelete);
                    }
                } else {
                    let metadata = new MetadataType(metadataType.xmlName, true, typeFolder, metadataType.suffix);
                    let childs = getMetadataObjectsFromGitDiff(metadataType, baseFolderSplits, fileName, filePath, groupGlobalActions);
                    if (!metadataForDeploy[metadata.name]) {
                        metadataForDeploy[metadata.name] = metadata;
                    }
                    Object.keys(childs).forEach(function (childKey) {
                        if (!metadataForDeploy[metadata.name].childs[childKey]) {
                            metadataForDeploy[metadata.name].childs[childKey] = childs[childKey];
                        }
                        if (childs[childKey].childs && Object.keys(childs[childKey].childs).length > 0) {
                            Object.keys(childs[childKey].childs).forEach(function (grandChildKey) {
                                if (!metadataForDeploy[metadata.name].childs[childKey].childs[grandChildKey]) {
                                    metadataForDeploy[metadata.name].childs[childKey].childs[grandChildKey] = childs[childKey].childs[grandChildKey];
                                }
                            });
                        }
                    });
                }
            } else if (diff.mode === 'deleted file') {
                if (METADATA_XML_RELATION[metadataType.xmlName]) {
                    let possibleMetadataToAddOnDelete = analizeDiffChanges(diff.removeChanges, metadataForDelete, metadataType, fileName, filePath);
                    if (possibleMetadataToAddOnDelete) {
                        metadataForDelete = MetadataUtils.combineMetadata(metadataForDelete, possibleMetadataToAddOnDelete);
                    }
                } else {
                    let metadata = new MetadataType(metadataType.xmlName, true, typeFolder, metadataType.suffix);
                    let childs = getMetadataObjectsFromGitDiff(metadataType, baseFolderSplits, fileName, filePath, groupGlobalActions);
                    if ((metadataType.xmlName === MetadataTypes.AURA_DEFINITION_BUNDLE && !fileNameWithExt.endsWith('.cmp') && !fileNameWithExt.endsWith('.evt') && !fileNameWithExt.endsWith('.app'))
                        || (metadataType.xmlName === MetadataTypes.LIGHTNING_COMPONENT_BUNDLE && !fileNameWithExt.endsWith('.js-meta.xml'))
                        || metadataType.xmlName === MetadataTypes.STATIC_RESOURCE && !fileNameWithExt.endsWith('.resource-meta.xml')) {
                        if (!metadataForDeploy[metadata.name]) {
                            metadataForDeploy[metadata.name] = metadata;
                        }
                        Object.keys(childs).forEach(function (childKey) {
                            if (!metadataForDeploy[metadata.name].childs[childKey]) {
                                metadataForDeploy[metadata.name].childs[childKey] = childs[childKey];
                            }
                            if (childs[childKey].childs && Object.keys(childs[childKey].childs).length > 0) {
                                Object.keys(childs[childKey].childs).forEach(function (grandChildKey) {
                                    if (!metadataForDeploy[metadata.name].childs[childKey].childs[grandChildKey]) {
                                        metadataForDeploy[metadata.name].childs[childKey].childs[grandChildKey] = childs[childKey].childs[grandChildKey];
                                    }
                                });
                            }
                        });
                    } else {
                        if (!metadataForDelete[metadata.name]) {
                            metadataForDelete[metadata.name] = metadata;
                        }
                        Object.keys(childs).forEach(function (childKey) {
                            if (!metadataForDelete[metadata.name].childs[childKey]) {
                                metadataForDelete[metadata.name].childs[childKey] = childs[childKey];
                            } else if (childs[childKey].checked) {
                                metadataForDelete[metadata.name].childs[childKey].checked = true;
                            }
                            if (childs[childKey].childs && Object.keys(childs[childKey].childs).length > 0) {
                                Object.keys(childs[childKey].childs).forEach(function (grandChildKey) {
                                    if (!metadataForDelete[metadata.name].childs[childKey].childs[grandChildKey]) {
                                        metadataForDelete[metadata.name].childs[childKey].childs[grandChildKey] = childs[childKey].childs[grandChildKey];
                                    }
                                });
                            }
                        });
                    }
                }
            }
        }
        let typesForPriorDelete = [
            MetadataTypes.LIGHTNING_COMPONENT_BUNDLE,
            MetadataTypes.AURA_DEFINITION_BUNDLE,
            MetadataTypes.STATIC_RESOURCE,
            MetadataTypes.APEX_CLASS,
            MetadataTypes.APEX_PAGE,
            MetadataTypes.APEX_TRIGGER,
            MetadataTypes.APEX_COMPONENT,
            MetadataTypes.EMAIL_TEMPLATE,
            MetadataTypes.DOCUMENT,
            MetadataTypes.REPORT,
            MetadataTypes.DASHBOARD,
        ];
        priorMetadataTypes(typesForPriorDelete, metadataForDelete, metadataForDeploy);
        let typesForPriorDeploy = [
            MetadataTypes.CUSTOM_LABEL,
            MetadataTypes.CUSTOM_LABELS,
            MetadataTypes.WORKFLOW_FIELD_UPDATE,
            MetadataTypes.WORKFLOW_OUTBOUND_MESSAGE,
            MetadataTypes.WORKFLOW_TASK,
            MetadataTypes.WORKFLOW_RULE,
            MetadataTypes.WORKFLOW_ALERT,
            MetadataTypes.SHARING_CRITERIA_RULE,
            MetadataTypes.SHARING_OWNER_RULE,
            MetadataTypes.SHARING_GUEST_RULE,
            MetadataTypes.SHARING_TERRITORY_RULE
        ];
        priorMetadataTypes(typesForPriorDeploy, metadataForDeploy, metadataForDelete);
        metadataForDeploy = MetadataUtils.orderMetadata(metadataForDeploy, true);
        metadataForDelete = MetadataUtils.orderMetadata(metadataForDelete, true);
        return {
            toDeploy: metadataForDeploy,
            toDelete: metadataForDelete
        };
    }

    /**
     * Method to convert a JSON string with Metadata JSON format or a Metadata JSON untyped Object to a Metadata JSON Object with MetadataType, MetadataObject and MetadataItem objects
     * @param {string | any} jsonDataOrJsonStr string or Object with Metadata JSON format to convert to typed Metadata JSON
     * @param {boolean} [removeEmptyTypes] true to remove types with no data
     * 
     * @returns {{ [key: string]: MetadataType }} Return a JSON Metadata Object with MetadataType, MetadataObject and MetadataItem instances insted untyped objects
     * 
     * @throws {WrongFilePathException} If the filePath is not a string or can't convert to absolute path
     * @throws {FileNotFoundException} If the file not exists or not have access to it
     * @throws {InvalidFilePathException} If the path is not a file
     * @throws {WrongFormatException} If file is not a JSON file or not have the correct Metadata JSON format
     */
    static deserializeMetadataTypes(jsonDataOrJsonStr: string | any, removeEmptyTypes?: boolean): { [key: string]: MetadataType } {
        if (!jsonDataOrJsonStr) {
            return {};
        }
        if (typeof jsonDataOrJsonStr === 'string') {
            try {
                jsonDataOrJsonStr = JSON.parse(jsonDataOrJsonStr);
            } catch (error) {
                throw new WrongFormatException('The provided data must be a valid Metadata JSON Object');
            }
        }
        jsonDataOrJsonStr = Validator.validateMetadataJSON(jsonDataOrJsonStr);
        const deserialized: { [key: string]: MetadataType } = {};
        Object.keys(jsonDataOrJsonStr).forEach((key) => {
            if (jsonDataOrJsonStr[key]) {
                const metadataType = new MetadataType(jsonDataOrJsonStr[key]);
                if (jsonDataOrJsonStr[key] && jsonDataOrJsonStr[key].childs && Object.keys(jsonDataOrJsonStr[key].childs).length > 0) {
                    Object.keys(jsonDataOrJsonStr[key].childs).forEach((childKey) => {
                        if (jsonDataOrJsonStr[key].childs[childKey]) {
                            metadataType.addChild(childKey, new MetadataObject(jsonDataOrJsonStr[key].childs[childKey]));
                            if (jsonDataOrJsonStr[key].childs[childKey] && jsonDataOrJsonStr[key].childs[childKey].childs && Object.keys(jsonDataOrJsonStr[key].childs[childKey].childs).length > 0) {
                                Object.keys(jsonDataOrJsonStr[key].childs[childKey].childs).forEach((grandChildKey) => {
                                    if (jsonDataOrJsonStr[key].childs[childKey].childs[grandChildKey]) {
                                        metadataType.getChild(childKey)!.addChild(grandChildKey, new MetadataItem(jsonDataOrJsonStr[key].childs[childKey].childs[grandChildKey]));
                                    }
                                });
                            }
                        }
                    });
                }
                if (metadataType.hasChilds() || (!metadataType.hasChilds() && !removeEmptyTypes)) {
                    deserialized[key] = metadataType;
                }
            }
        });
        return deserialized;
    }
}

function preparePackageFromXML(pkg: any, apiVersion?: string): any {
    let result: any = {};
    if (pkg.Package) {
        result.version = apiVersion || pkg.Package.version;
        result.prepared = true;
        let types = XMLUtils.forceArray(pkg.Package.types);
        for (const type of types) {
            result[type.name] = [];
            let members = XMLUtils.forceArray(type.members);
            for (const member of members) {
                result[type.name].push(member);
            }
        }
    } else if (pkg.prepared) {
        return pkg;
    }
    return result;
}

function createMetadataObjectsFromArray(metadataType: MetadataType, dataList: any[], downloadAll?: boolean, namespacePrefix?: string, fromPackage?: boolean, groupGlobalActions?: boolean): MetadataType {
    for (const obj of dataList) {
        let separator;
        if (metadataType.name === MetadataTypes.EMAIL_TEMPLATE || metadataType.name === MetadataTypes.DOCUMENT || metadataType.name === MetadataTypes.REPORT || metadataType.name === MetadataTypes.DASHBOARD) {
            separator = '/';
        } else if (metadataType.name === MetadataTypes.LAYOUT || metadataType.name === MetadataTypes.CUSTOM_OBJECT_TRANSLATIONS || metadataType.name === MetadataTypes.FLOW || metadataType.name === MetadataTypes.STANDARD_VALUE_SET_TRANSLATION) {
            separator = '-';
        } else {
            separator = '.';
        }
        let name;
        let item;
        if (obj) {
            const objName = obj.fullName || obj;
            if (objName === '*') {
                continue;
            }
            if (objName.indexOf(separator) !== -1) {
                name = objName.substring(0, objName.indexOf(separator));
                item = objName.substring(objName.indexOf(separator) + 1);
            } else {
                name = objName;
            }
            if (downloadAll) {
                if (!item) {
                    if (metadataType.name === MetadataTypes.QUICK_ACTION) {
                        if (groupGlobalActions) {
                            item = name;
                            name = 'GlobalActions';
                        } else {
                            item = name;
                        }
                        metadataType.addChild(name, new MetadataObject(name, fromPackage));
                        metadataType.getChild(name)!.addChild(item, new MetadataItem(item, fromPackage));
                    } else {
                        metadataType.addChild(name, new MetadataObject(name, fromPackage));
                    }
                } else {
                    if (metadataType.name === MetadataTypes.QUICK_ACTION) {
                        if (item === name && groupGlobalActions) {
                            item = name;
                            name = 'GlobalActions';
                        } else if (item === name) {
                            item = name;
                        }
                    }
                    metadataType.addChild(name, new MetadataObject(name, fromPackage));
                    metadataType.getChild(name)!.addChild(item, new MetadataItem(item, fromPackage));
                }
            } else {
                if (!item && (!obj.namespacePrefix || obj.namespacePrefix === namespacePrefix)) {
                    if (metadataType.name === MetadataTypes.QUICK_ACTION) {
                        if (groupGlobalActions) {
                            item = name;
                            name = 'GlobalActions';
                        } else {
                            item = name;
                        }
                        metadataType.addChild(name, new MetadataObject(name, fromPackage));
                        metadataType.getChild(name)!.addChild(item, new MetadataItem(item, fromPackage));
                    } else {
                        metadataType.addChild(name, new MetadataObject(name, fromPackage));
                    }
                } else if (!obj.namespacePrefix || obj.namespacePrefix === namespacePrefix) {
                    if (metadataType.name === MetadataTypes.QUICK_ACTION) {
                        if (item === name && groupGlobalActions) {
                            item = name;
                            name = 'GlobalActions';
                        } else if (item === name) {
                            item = name;
                        }
                    }
                    metadataType.addChild(name, new MetadataObject(name, fromPackage));
                    metadataType.getChild(name)!.addChild(item, new MetadataItem(item, fromPackage));
                }
            }
        }
    }
    return metadataType;
}

function getJSONNameValuePair(line: string): any {
    let tmpLine = StrUtils.replace(StrUtils.replace(line, '}', ''), '{', '');
    if (tmpLine.indexOf('[') !== -1 && tmpLine.indexOf(']') === -1) {
        tmpLine = StrUtils.replace(tmpLine, '[', '');
    }
    let splits = tmpLine.split(':');
    let fieldName;
    let fieldValue;
    if (splits.length >= 0 && splits[0]) {
        fieldName = StrUtils.replace(StrUtils.replace(splits[0].trim(), "'", ''), '"', '');
    }
    if (splits.length >= 1 && splits[1]) {
        fieldValue = StrUtils.replace(StrUtils.replace(splits[1].trim(), "'", ''), '"', '');
        if (fieldValue.endsWith(",")) {
            fieldValue = fieldValue.substring(0, fieldValue.length - 1);
        } else {
            fieldValue = fieldValue.substring(0, fieldValue.length);
        }
    }
    return {
        name: fieldName,
        value: fieldValue
    };
}

function getFolderDeveloperName(folders: any[], idOrName: string, searchById?: boolean): string | undefined {
    if (folders) {
        if (idOrName === 'Private Reports') {
            return undefined;
        }
        for (const folder of folders) {
            if (searchById && folder.Id && idOrName && folder.Id === idOrName) {
                return folder.DeveloperName;
            } else if (!searchById && folder.Name && idOrName && folder.Name === idOrName && idOrName !== undefined) {
                return folder.DeveloperName;
            }
        }
    }
    return UNFILED_PUBLIC_FOLDER;
}

function getMetadataFromFiles(metadataDetail: MetadataDetail, metadata: { [key: string]: MetadataType }, folderPath: string): void {
    let mainObject = new MetadataType(metadataDetail.xmlName, false, folderPath, metadataDetail.suffix);
    mainObject.childs = getMetadataObjects(folderPath, false) || {};
    metadata[metadataDetail.xmlName] = mainObject;
    let files = FileReader.readDirSync(folderPath);
    let collectionsData = METADATA_XML_RELATION[metadataDetail.xmlName];
    for (const file of files) {
        let path = folderPath + '/' + file;
        let xmlData = XMLParser.parseXML(FileReader.readFileSync(path));
        if (metadataDetail.xmlName === MetadataTypes.CUSTOM_LABELS) {
            if (xmlData[metadataDetail.xmlName]) {
                Object.keys(collectionsData).forEach(function (collectionName) {
                    let collectionData = collectionsData[collectionName];
                    if (xmlData[metadataDetail.xmlName][collectionName]) {
                        xmlData[metadataDetail.xmlName][collectionName] = Utils.forceArray(xmlData[metadataDetail.xmlName][collectionName]);
                        for (let xmlElement of xmlData[metadataDetail.xmlName][collectionName]) {
                            let elementKey = xmlElement[collectionData.fieldKey];
                            if (!metadata[collectionData.type]) {
                                metadata[collectionData.type] = new MetadataType(collectionData.type, false, folderPath, metadataDetail.suffix);
                            }
                            if (!metadata[collectionData.type].childs[elementKey]) {
                                metadata[collectionData.type].childs[elementKey] = new MetadataObject(elementKey, false, path);
                            }
                        }
                    }
                });
            }
        } else {
            if (xmlData[metadataDetail.xmlName]) {
                Object.keys(collectionsData).forEach(function (collectionName) {
                    let collectionData = collectionsData[collectionName];
                    if (xmlData[metadataDetail.xmlName][collectionName]) {
                        let sObj = file.substring(0, file.indexOf('.'));
                        if (!metadata[collectionData.type]) {
                            metadata[collectionData.type] = new MetadataType(collectionData.type, false, folderPath, metadataDetail.suffix);
                        }
                        if (!metadata[collectionData.type].childs[sObj]) {
                            metadata[collectionData.type].childs[sObj] = new MetadataObject(sObj, false);
                        }
                        xmlData[metadataDetail.xmlName][collectionName] = Utils.forceArray(xmlData[metadataDetail.xmlName][collectionName]);
                        for (let xmlElement of xmlData[metadataDetail.xmlName][collectionName]) {
                            let elementKey = xmlElement[collectionData.fieldKey];
                            if (!metadata[collectionData.type].childs[sObj].childs[elementKey]) {
                                metadata[collectionData.type].childs[sObj].childs[elementKey] = new MetadataItem(elementKey, false, path);
                            }
                        }
                    }
                });
            }
        }
    }
}

function getMetadataFromFolders(folderPath: string, metadataDetail: MetadataDetail, separator: string, groupName?: string): MetadataType {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(metadataDetail.xmlName, false, folderPath, metadataDetail.suffix);
    let metadataObjects: { [key: string]: MetadataObject } = {};
    for (const file of files) {
        let path = folderPath + '/' + file;
        let fileParts = file.split(separator);
        let sObj = fileParts[0];
        let metadataName = fileParts[1];
        if (metadataDetail.xmlName === MetadataTypes.QUICK_ACTION) {
            if (groupName && !metadataObjects[groupName] && StrUtils.contains(metadataName, 'quickAction-meta')) {
                metadataObjects[groupName] = new MetadataObject(groupName, false, folderPath);
            } else if (!metadataObjects[sObj]) {
                metadataObjects[sObj] = new MetadataObject(sObj, false, folderPath);
            }

            if (metadataName && metadataName.length > 0 && !StrUtils.contains(metadataName, 'quickAction-meta') && !metadataObjects[sObj].childs[metadataName]) {
                metadataObjects[sObj].childs[metadataName] = new MetadataItem(metadataName, false, path);
            } else if (groupName) {
                metadataObjects[groupName].childs[sObj] = new MetadataItem(sObj, false, path);
            } else {
                metadataObjects[sObj].childs[sObj] = new MetadataItem(sObj, false, path);
            }
        } else {
            if (!metadataObjects[sObj]) {
                metadataObjects[sObj] = new MetadataObject(sObj, false, folderPath);
            }
            if (metadataName && metadataName.length > 0 && !metadataObjects[sObj].childs[metadataName]) {
                metadataObjects[sObj].childs[metadataName] = new MetadataItem(metadataName, false, path);
            }
        }
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getDashboardsMetadataFromFolder(folderPath: string, metadataDetail: MetadataDetail): MetadataType {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(metadataDetail.xmlName, false, folderPath, metadataDetail.suffix);
    let metadataObjects: { [key: string]: MetadataObject } = {};
    for (const dashboardFolder of files) {
        let fPath = folderPath + '/' + dashboardFolder;
        if (dashboardFolder.indexOf('.') === -1) {
            if (!metadataObjects[dashboardFolder]) {
                metadataObjects[dashboardFolder] = new MetadataObject(dashboardFolder, false, fPath);
            }
            let dashboards = FileReader.readDirSync(fPath);
            for (const dashboard of dashboards) {
                let path = fPath + '/' + dashboard;
                let name = dashboard.substring(0, dashboard.indexOf('.'));
                if (name && name.length > 0 && !metadataObjects[dashboardFolder].childs[name]) {
                    metadataObjects[dashboardFolder].childs[name] = new MetadataItem(name, false, path);
                }
            }
        }
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getReportsMetadataFromFolder(folderPath: string, metadataDetail: MetadataDetail): MetadataType {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(metadataDetail.xmlName, false, folderPath, metadataDetail.suffix);
    let metadataObjects: { [key: string]: MetadataObject } = {};
    for (const reportsFolder of files) {
        let fPath = folderPath + '/' + reportsFolder;
        if (reportsFolder.indexOf('.') === -1) {
            if (!metadataObjects[reportsFolder]) {
                metadataObjects[reportsFolder] = new MetadataObject(reportsFolder, false, fPath);
            }
            let reports = FileReader.readDirSync(fPath);
            for (const report of reports) {
                let path = fPath + '/' + report;
                let name = report.substring(0, report.indexOf('.'));
                if (name && name.length > 0 && !metadataObjects[reportsFolder].childs[name]) {
                    metadataObjects[reportsFolder].childs[name] = new MetadataItem(name, false, path);
                }
            }
        }
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getDocumentsMetadataFromFolder(folderPath: string, metadataDetail: MetadataDetail): MetadataType {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(metadataDetail.xmlName, false, folderPath, metadataDetail.suffix);
    let metadataObjects: { [key: string]: MetadataObject } = {};
    for (const docFolder of files) {
        let fPath = folderPath + '/' + docFolder;
        if (docFolder.indexOf('.') === -1) {
            if (!metadataObjects[docFolder]) {
                metadataObjects[docFolder] = new MetadataObject(docFolder, false, fPath);
            }
            let docs = FileReader.readDirSync(fPath);
            for (const doc of docs) {
                let path = fPath + '/' + doc;
                if (doc.indexOf('.document-meta.xml') === -1) {
                    if (doc && doc.length > 0 && !metadataObjects[docFolder].childs[doc]) {
                        metadataObjects[docFolder].childs[doc] = new MetadataItem(doc, false, path);
                    }
                }
            }
        }
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getEmailTemplateMetadataFromFolder(folderPath: string, metadataDetail: MetadataDetail): MetadataType {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(metadataDetail.xmlName, false, folderPath, metadataDetail.suffix);
    let metadataObjects: { [key: string]: MetadataObject } = {};
    for (const emailFolder of files) {
        let fPath = folderPath + '/' + emailFolder;
        if (emailFolder.indexOf('.') === -1) {
            if (!metadataObjects[emailFolder]) {
                metadataObjects[emailFolder] = new MetadataObject(emailFolder, false, fPath);
            }
            let emails = FileReader.readDirSync(folderPath + '/' + emailFolder);
            for (const email of emails) {
                let path = fPath + '/' + email;
                let name = email.substring(0, email.indexOf('.'));
                if (name && name.length > 0 && !metadataObjects[emailFolder].childs[name]) {
                    metadataObjects[emailFolder].childs[name] = new MetadataItem(name, false, path);
                }
            }
        }
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getFlowsMetadataFromFolder(folderPath: string, metadataDetail: MetadataDetail): MetadataType {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(metadataDetail.xmlName, false, folderPath, metadataDetail.suffix);
    let metadataObjects: { [key: string]: MetadataObject } = {};
    for (const flowFile of files) {
        let path = folderPath + '/' + flowFile;
        let name = flowFile.substring(0, flowFile.indexOf('.'));
        let flow = undefined;
        let version = undefined;
        if (name.indexOf('-') !== -1) {
            flow = name.substring(0, name.indexOf('-')).trim();
            version = name.substring(name.indexOf('-') + 1).trim();
        } else {
            flow = name.trim();
        }
        if (!metadataObjects[flow]) {
            metadataObjects[flow] = new MetadataObject(flow, false, ((version !== undefined) ? folderPath : path));
        }
        if (version && version.length > 0) {
            metadataObjects[flow].childs[version] = new MetadataItem(version, false, path);
        }
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getStandardValueSetTranslationMetadataFromFolder(folderPath: string, metadataDetail: MetadataDetail): MetadataType {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(metadataDetail.xmlName, false, folderPath);
    let metadataObjects: { [key: string]: MetadataObject } = {};
    for (const translationFile of files) {
        let path = folderPath + '/' + translationFile;
        let name = translationFile.substring(0, translationFile.indexOf('.'));
        let translation = undefined;
        let version = undefined;
        if (name.indexOf('-') !== -1) {
            translation = name.substring(0, name.indexOf('-')).trim();
            version = name.substring(name.indexOf('-') + 1).trim();
        }
        if (translation && !metadataObjects[translation]) {
            metadataObjects[translation] = new MetadataObject(translation, false, folderPath);
        }
        if (translation && version && version.length > 0) {
            metadataObjects[translation].childs[version] = new MetadataItem(version, false, path);
        }
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getLayoutsMetadataFromFolder(folderPath: string, metadataDetail: MetadataDetail): MetadataType {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(metadataDetail.xmlName, false, folderPath, metadataDetail.suffix);
    let metadataObjects: { [key: string]: MetadataObject } = {};
    for (const layoutFile of files) {
        let path = folderPath + '/' + layoutFile;
        let name = layoutFile.substring(0, layoutFile.indexOf('.'));
        let sObj = name.substring(0, name.indexOf('-')).trim();
        let layout = name.substring(name.indexOf('-') + 1).trim();
        if (!metadataObjects[sObj]) {
            metadataObjects[sObj] = new MetadataObject(sObj, false, folderPath);
        }
        if (layout && layout.length > 0) {
            metadataObjects[sObj].childs[layout] = new MetadataItem(layout, false, path);
        }
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getCustomObjectsMetadata(metadata: { [key: string]: MetadataType }, objectsPath: string): { [key: string]: MetadataType } {
    let files = FileReader.readDirSync(objectsPath);
    metadata[MetadataTypes.CUSTOM_OBJECT] = new MetadataType(MetadataTypes.CUSTOM_OBJECT, false, objectsPath, 'object');
    metadata[MetadataTypes.CUSTOM_FIELD] = new MetadataType(MetadataTypes.CUSTOM_FIELD, false, objectsPath, 'field');
    metadata[MetadataTypes.INDEX] = new MetadataType(MetadataTypes.INDEX, false, objectsPath, 'index');
    metadata[MetadataTypes.RECORD_TYPE] = new MetadataType(MetadataTypes.RECORD_TYPE, false, objectsPath, 'recordType');
    metadata[MetadataTypes.LISTVIEW] = new MetadataType(MetadataTypes.LISTVIEW, false, objectsPath, 'listView');
    metadata[MetadataTypes.BUSINESS_PROCESS] = new MetadataType(MetadataTypes.BUSINESS_PROCESS, false, objectsPath, 'businessProcess');
    metadata[MetadataTypes.COMPACT_LAYOUT] = new MetadataType(MetadataTypes.COMPACT_LAYOUT, false, objectsPath, 'compactLayout');
    metadata[MetadataTypes.VALIDATION_RULE] = new MetadataType(MetadataTypes.VALIDATION_RULE, false, objectsPath, 'validationRule');
    metadata[MetadataTypes.SHARING_REASON] = new MetadataType(MetadataTypes.SHARING_REASON, false, objectsPath, 'sharingReason');
    metadata[MetadataTypes.FIELD_SET] = new MetadataType(MetadataTypes.FIELD_SET, false, objectsPath, 'fieldSet');
    metadata[MetadataTypes.WEBLINK] = new MetadataType(MetadataTypes.WEBLINK, false, objectsPath, 'webLink');
    for (const objFolder of files) {
        let objPath = objectsPath + '/' + objFolder;
        let objFilePath = objPath + '/' + objFolder + '.object-meta.xml';
        if (FileChecker.isExists(objPath + '/fields')) {
            let fields = new MetadataObject(objFolder, false, objPath + '/fields');
            fields.childs = getMetadataItems(objPath + '/fields', false);
            metadata[MetadataTypes.CUSTOM_FIELD].childs[objFolder] = fields;
        }
        if (FileChecker.isExists(objPath + '/indexes')) {
            let fields = new MetadataObject(objFolder, false, objPath + '/indexes');
            fields.childs = getMetadataItems(objPath + '/indexes', false);
            metadata[MetadataTypes.INDEX].childs[objFolder] = fields;
        }
        if (FileChecker.isExists(objPath + '/sharingReasons')) {
            let fields = new MetadataObject(objFolder, false, objPath + '/sharingReasons');
            fields.childs = getMetadataItems(objPath + '/sharingReasons', false);
            metadata[MetadataTypes.SHARING_REASON].childs[objFolder] = fields;
        }
        if (FileChecker.isExists(objPath + '/fieldSets')) {
            let fields = new MetadataObject(objFolder, false, objPath + '/fieldSets');
            fields.childs = getMetadataItems(objPath + '/fieldSets', false);
            metadata[MetadataTypes.FIELD_SET].childs[objFolder] = fields;
        }
        if (FileChecker.isExists(objPath + '/recordTypes')) {
            let recordTypes = new MetadataObject(objFolder, false, objPath + '/recordTypes');
            recordTypes.childs = getMetadataItems(objPath + '/recordTypes');
            metadata[MetadataTypes.RECORD_TYPE].childs[objFolder] = recordTypes;
        }
        if (FileChecker.isExists(objPath + '/listViews')) {
            let listviews = new MetadataObject(objFolder, false, objPath + '/listViews');
            listviews.childs = getMetadataItems(objPath + '/listViews');
            metadata[MetadataTypes.LISTVIEW].childs[objFolder] = listviews;
        }
        if (FileChecker.isExists(objPath + '/businessProcesses')) {
            let bussinesProcesses = new MetadataObject(objFolder, false, objPath + '/businessProcesses');
            bussinesProcesses.childs = getMetadataItems(objPath + '/businessProcesses');
            metadata[MetadataTypes.BUSINESS_PROCESS].childs[objFolder] = bussinesProcesses;
        }
        if (FileChecker.isExists(objPath + '/compactLayouts')) {
            let compactLayouts = new MetadataObject(objFolder, false, objPath + '/compactLayouts');
            compactLayouts.childs = getMetadataItems(objPath + '/compactLayouts');
            metadata[MetadataTypes.COMPACT_LAYOUT].childs[objFolder] = compactLayouts;
        }
        if (FileChecker.isExists(objPath + '/validationRules')) {
            let validationRules = new MetadataObject(objFolder, false, objPath + '/validationRules');
            validationRules.childs = getMetadataItems(objPath + '/validationRules');
            metadata[MetadataTypes.VALIDATION_RULE].childs[objFolder] = validationRules;
        }
        if (FileChecker.isExists(objPath + '/webLinks')) {
            let weblinks = new MetadataObject(objFolder, false, objPath + '/webLinks');
            weblinks.childs = getMetadataItems(objPath + '/webLinks');
            metadata[MetadataTypes.WEBLINK].childs[objFolder] = weblinks;
        }
        if (FileChecker.isExists(objFilePath)) {
            metadata[MetadataTypes.CUSTOM_OBJECT].childs[objFolder] = new MetadataObject(objFolder, false, objFilePath);
        }
    }
    return metadata;
}

function getMetadataObjects(folderPath: string, onlyFolders?: boolean): { [key: string]: MetadataObject } | undefined {
    let objects: { [key: string]: MetadataObject } | undefined;
    if (FileChecker.isExists(folderPath)) {
        let files = FileReader.readDirSync(folderPath);
        if (files.length > 0) {
            objects = {};
            for (const file of files) {
                let path = folderPath + '/' + file;
                if (onlyFolders && file.indexOf('.') === -1) {
                    if (!objects[file]) {
                        objects[file] = new MetadataObject(file, false, path);
                    }
                } else if (!onlyFolders) {
                    let name = file.substring(0, file.indexOf('.'));
                    if (!objects[name]) {
                        objects[name] = new MetadataObject(name, false, path);
                    }
                }
            }
        }
    }
    return objects;
}

function getMetadataItems(folderPath: string, checked?: boolean): { [key: string]: MetadataItem } {
    let items: { [key: string]: MetadataItem } = {};
    if (FileChecker.isExists(folderPath)) {
        let files = FileReader.readDirSync(folderPath);
        for (const file of files) {
            let path = folderPath + '/' + file;
            if (FileChecker.isFile(path)) {
                let name = file.substring(0, file.indexOf('.'));
                if (!items[name]) {
                    items[name] = new MetadataItem(name, checked || false, path);
                }
            }
        }
    }
    return items;
}

function analizeDiffChanges(diffChanges: string[], metadata: { [key: string]: MetadataType }, metadataDetail: MetadataDetail, fileName: string, filePath: string): { [key: string]: MetadataType } | undefined {
    let added = true;
    let possibleMetadataToAdd: { [key: string]: MetadataType } | undefined;
    let typePath = filePath.substring(0, filePath.indexOf('/' + metadataDetail.directoryName));
    typePath = typePath + '/' + metadataDetail.directoryName;
    if (diffChanges.length > 0) {
        added = false;
        let startCollectionTag;
        let endCollectionTag;
        let onMember = false;
        let fullNameContent = '';
        let collectionData;
        for (let changedLine of diffChanges) {
            changedLine = StrUtils.replace(changedLine, ',', '');
            if (!startCollectionTag) {
                startCollectionTag = getChildTypeStartTag(metadataDetail.xmlName, changedLine);
            }
            if (startCollectionTag) {
                collectionData = METADATA_XML_RELATION[metadataDetail.xmlName][startCollectionTag];
                let startNameTag = XMLParser.startTag(changedLine, collectionData.fieldKey);
                let endNameTag = XMLParser.endTag(changedLine, collectionData.fieldKey);
                if (startNameTag !== undefined && endNameTag !== undefined) {
                    let startTagIndex = changedLine.indexOf('<' + startNameTag + '>');
                    let endTagIndex = changedLine.indexOf('</' + endNameTag + '>');
                    fullNameContent = changedLine.substring(startTagIndex, endTagIndex);
                    fullNameContent = fullNameContent.substring(fullNameContent.indexOf('>') + 1);
                }
                else if (startNameTag !== undefined) {
                    onMember = true;
                    fullNameContent += changedLine;
                } else if (onMember) {
                    fullNameContent += changedLine;
                } else if (endNameTag !== undefined) {
                    onMember = false;
                    fullNameContent += changedLine;
                }
            }
            if (startCollectionTag && !endCollectionTag) {
                endCollectionTag = XMLParser.endTag(changedLine, startCollectionTag);
            }
            if (endCollectionTag) {
                if (!collectionData) {
                    collectionData = METADATA_XML_RELATION[metadataDetail.xmlName][endCollectionTag];
                }
                fullNameContent = StrUtils.replace(fullNameContent, ',', '').trim();
                if (fullNameContent.length > 0) {
                    let type = collectionData.type;
                    if (!metadata[type]) {
                        metadata[type] = new MetadataType(type, true, typePath, metadataDetail.suffix);
                    }
                    if (metadataDetail.xmlName === MetadataTypes.CUSTOM_LABELS) {
                        if (!metadata[type].childs[fullNameContent]) {
                            metadata[type].childs[fullNameContent] = new MetadataObject(fullNameContent, true, filePath);
                        }
                    } else {
                        if (!metadata[type].childs[fileName]) {
                            metadata[type].childs[fileName] = new MetadataObject(fileName, true, filePath);
                        }
                        metadata[type].childs[fileName].childs[fullNameContent] = new MetadataItem(fullNameContent, true, filePath);
                    }
                    added = true;
                    fullNameContent = '';
                }
                startCollectionTag = undefined;
                endCollectionTag = undefined;
            }
        }
    }
    if (!added) {
        possibleMetadataToAdd = {};
        possibleMetadataToAdd[metadataDetail.xmlName] = new MetadataType(metadataDetail.xmlName, true, typePath, metadataDetail.suffix);
        if (!possibleMetadataToAdd[metadataDetail.xmlName].childs[fileName]) {
            possibleMetadataToAdd[metadataDetail.xmlName].childs[fileName] = new MetadataObject(fileName, true, filePath);
        }
    }
    return possibleMetadataToAdd;
}

function getMetadataObjectsFromGitDiff(metadataDetail: MetadataDetail, baseFolderSplits: string[], fileName: string, filePath: string, groupGlobalActions?: boolean): { [key: string]: MetadataObject } {
    let specialTypes = [MetadataTypes.CUSTOM_METADATA, MetadataTypes.APPROVAL_PROCESSES, MetadataTypes.DUPLICATE_RULE,
    MetadataTypes.QUICK_ACTION, MetadataTypes.LAYOUT, MetadataTypes.AURA_DEFINITION_BUNDLE, MetadataTypes.LIGHTNING_COMPONENT_BUNDLE, MetadataTypes.ASSIGNMENT_RULES, MetadataTypes.AUTORESPONSE_RULES,
    MetadataTypes.WORKFLOW, MetadataTypes.CUSTOM_LABELS, MetadataTypes.SHARING_RULES, MetadataTypes.FLOW, MetadataTypes.CUSTOM_OBJECT_TRANSLATIONS, MetadataTypes.STATIC_RESOURCE];
    let objects: { [key: string]: MetadataObject } = {};
    let fistPartBaseFolder = baseFolderSplits[0];
    let folderPath = PathUtils.getBasename(filePath);
    if (baseFolderSplits.length > 1 && !specialTypes.includes(metadataDetail.xmlName)) {
        let metadataObjectFolderName = baseFolderSplits[1];
        if (fileName.indexOf('Folder-meta.xml') === -1) {
            if (metadataDetail.xmlName === MetadataTypes.DOCUMENT) {
                if (fileName.indexOf('-meta.xml') === -1) {
                    if (!objects[metadataObjectFolderName]) {
                        objects[metadataObjectFolderName] = new MetadataObject(metadataObjectFolderName, false, filePath);
                    }
                    if (fistPartBaseFolder === 'objects' && baseFolderSplits.length > 2) {
                        objects[metadataObjectFolderName].path = folderPath;
                        objects[metadataObjectFolderName].childs[fileName] = new MetadataItem(fileName, true, filePath);
                    } else if (baseFolderSplits.length > 1) {
                        objects[metadataObjectFolderName].path = folderPath;
                        objects[metadataObjectFolderName].childs[fileName] = new MetadataItem(fileName, true, filePath);
                    } else {
                        objects[metadataObjectFolderName].checked = true;
                    }
                }
            } else {
                if (!objects[metadataObjectFolderName]) {
                    objects[metadataObjectFolderName] = new MetadataObject(metadataObjectFolderName, false, filePath);
                }
                if (metadataDetail.xmlName !== MetadataTypes.CUSTOM_OBJECT) {
                    if (fistPartBaseFolder === 'objects' && baseFolderSplits.length > 2) {
                        objects[metadataObjectFolderName].path = folderPath;
                        objects[metadataObjectFolderName].childs[fileName] = new MetadataItem(fileName, true, filePath);
                    } else if (baseFolderSplits.length > 1) {
                        objects[metadataObjectFolderName].path = folderPath;
                        objects[metadataObjectFolderName].childs[fileName] = new MetadataItem(fileName, true, filePath);
                    } else {
                        objects[metadataObjectFolderName].checked = true;
                    }
                } else {
                    objects[metadataObjectFolderName].checked = true;
                }
            }
        } else {
            fileName = StrUtils.replace(fileName, '-meta.xml', '');
            fileName = fileName.substring(0, fileName.lastIndexOf('.'));
            if (!objects[fileName]) {
                objects[fileName] = new MetadataObject(fileName, true, filePath);
            } else {
                objects[fileName].checked = true;
            }
        }
    } else if (metadataDetail.xmlName === MetadataTypes.CUSTOM_METADATA || metadataDetail.xmlName === MetadataTypes.APPROVAL_PROCESSES || metadataDetail.xmlName === MetadataTypes.DUPLICATE_RULE) {
        let fileNameParts = fileName.split('.');
        let sobj = fileNameParts[0].trim();
        let item = fileNameParts[1].trim();
        if (!objects[sobj]) {
            objects[sobj] = new MetadataObject(sobj, true, folderPath);
        }
        if (!objects[sobj].childs[item]) {
            objects[sobj].childs[item] = new MetadataItem(item, true, filePath);
        }
    } else if (metadataDetail.xmlName === MetadataTypes.QUICK_ACTION) {
        let fileNameParts = fileName.split('.');
        let sobj = fileNameParts[0].trim();
        let item = fileNameParts[1].trim();
        if (sobj === item && groupGlobalActions) {
            sobj = 'GlobalActions';
        }
        else if (sobj === item) {
            item = sobj;
        }
        if (!objects[sobj]) {
            objects[sobj] = new MetadataObject(sobj, true, folderPath);
        }
        if (!objects[sobj].childs[item]) {
            objects[sobj].childs[item] = new MetadataItem(item, true, filePath);
        }
    } else if (metadataDetail.xmlName === MetadataTypes.LAYOUT || metadataDetail.xmlName === MetadataTypes.STANDARD_VALUE_SET_TRANSLATION) {
        let sobj = fileName.substring(0, fileName.indexOf('-')).trim();
        let item = fileName.substring(fileName.indexOf('-') + 1).trim();
        if (!objects[sobj]) {
            objects[sobj] = new MetadataObject(sobj, true, folderPath);
        }
        if (!objects[sobj].childs[item]) {
            objects[sobj].childs[item] = new MetadataItem(item, true, filePath);
        }
    } else if (metadataDetail.xmlName === MetadataTypes.CUSTOM_OBJECT_TRANSLATIONS) {
        let folderName = baseFolderSplits[0];
        let sobj = folderName.substring(0, folderName.indexOf('-')).trim();
        let item = folderName.substring(folderName.indexOf('-') + 1).trim();
        let lastFolder = PathUtils.getBasename(folderPath);
        if (!objects[sobj]) {
            objects[sobj] = new MetadataObject(sobj, true, lastFolder);
        }
        if (!objects[sobj].childs[item]) {
            objects[sobj].childs[item] = new MetadataItem(item, true, folderPath);
        }
    } else if (metadataDetail.xmlName === MetadataTypes.STATIC_RESOURCE) {
        let resourcePath = filePath.substring(0, filePath.indexOf('/' + metadataDetail.directoryName));
        resourcePath = resourcePath + '/' + metadataDetail.directoryName + '/' + baseFolderSplits[1] + + '.' + metadataDetail.suffix + '-meta.xml';
        if (baseFolderSplits.length === 1) {
            if (!objects[fileName]) {
                objects[fileName] = new MetadataObject(fileName, true, resourcePath);
            }
        } else {
            if (!objects[baseFolderSplits[1]]) {
                objects[baseFolderSplits[1]] = new MetadataObject(baseFolderSplits[1], true, resourcePath);
            }
        }
    } else if (metadataDetail.xmlName === MetadataTypes.FLOW) {
        if (fileName.indexOf('-') !== -1) {
            let sobj = fileName.substring(0, fileName.indexOf('-')).trim();
            let item = fileName.substring(fileName.indexOf('-') + 1).trim();
            if (!objects[sobj]) {
                objects[sobj] = new MetadataObject(sobj, true, folderPath);
            }
            if (!objects[sobj].childs[item]) {
                objects[sobj].childs[item] = new MetadataItem(item, true, filePath);
            }
        } else {
            if (!objects[fileName]) {
                objects[fileName] = new MetadataObject(fileName, true, filePath);
            }
        }
    } else if (metadataDetail.xmlName === MetadataTypes.AURA_DEFINITION_BUNDLE || metadataDetail.xmlName === MetadataTypes.LIGHTNING_COMPONENT_BUNDLE) {
        if (baseFolderSplits[1] && !objects[baseFolderSplits[1]]) {
            objects[baseFolderSplits[1]] = new MetadataObject(baseFolderSplits[1], true, folderPath);
        }
    } else {
        if (fileName.indexOf('Folder-meta.xml') !== -1) {
            fileName = StrUtils.replace(fileName, '-meta.xml', '');
            fileName = fileName.substring(0, fileName.lastIndexOf('.'));
            if (!objects[fileName]) {
                objects[fileName] = new MetadataObject(fileName, true, filePath);
            } else {
                objects[fileName].checked = true;
            }
        } else {
            if (!objects[fileName]) {
                objects[fileName] = new MetadataObject(fileName, true, filePath);
            }
        }
    }
    return objects;
}

function getChildTypeStartTag(metadataType: string, content: string) {
    let tag;
    let xmlKeys = Object.keys(METADATA_XML_RELATION[metadataType]);
    for (const xmlKey of xmlKeys) {
        tag = XMLParser.startTag(StrUtils.replace(content, ',', ''), xmlKey);
        if (tag) {
            break;
        }
    }
    return tag;
}

function priorMetadataTypes(types: string[], metadataToPrior: { [key: string]: MetadataType }, metadataToRemove: { [key: string]: MetadataType }): void {
    for (const type of types) {
        if (metadataToPrior[type]) {
            Object.keys(metadataToPrior[type].childs).forEach(function (childKey) {
                if (metadataToPrior[type].childs[childKey].childs && Object.keys(metadataToPrior[type].childs[childKey].childs).length > 0) {
                    if (metadataToRemove[type] && metadataToRemove[type].childs[childKey] && metadataToRemove[type].childs[childKey].checked) {
                        metadataToRemove[type].childs[childKey].checked = false;
                    }
                    Object.keys(metadataToPrior[type].childs[childKey].childs).forEach(function (grandChildKey) {
                        if (metadataToRemove[type] && metadataToRemove[type].childs[childKey] && metadataToRemove[type].childs[childKey].childs[grandChildKey] && metadataToRemove[type].childs[childKey].childs[grandChildKey].checked) {
                            metadataToRemove[type].childs[childKey].childs[grandChildKey].checked = false;
                        }
                    });
                } else {
                    if (metadataToRemove[type] && metadataToRemove[type].childs[childKey] && metadataToRemove[type].childs[childKey].checked) {
                        metadataToRemove[type].childs[childKey].checked = false;
                    }
                }
            });
        }
    }
}