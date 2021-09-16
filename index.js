const { MetadataDetail, MetadataType, MetadataObject, MetadataItem, SObject, SObjectField, PicklistValue, RecordType } = require('@ah/core').Types;
const { WrongFormatException, WrongDatatypeException } = require('@ah/core').Exceptions;
const { XMLParser, XMLUtils } = require('@ah/languages').XML;
const { Utils, StrUtils, Validator, ProjectUtils, MetadataUtils } = require('@ah/core').CoreUtils;
const { FileReader, FileChecker, PathUtils } = require('@ah/core').FileSystem;
const { MetadataTypes, MetadataSuffixByType, NotIncludedMetadata } = require('@ah/core').Values;
const UNFILED_PUBLIC_FOLDER = 'unfiled$public';

METADATA_XML_RELATION = {
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
}

/**
 * Class with several util methods to create the Aura Helper Metadata JSON from several sources like queries result, file system, git... or work with other SObject or Metadata object types like MetadataDetails, MetadataFolderMap or SOjects collections.
 */
class MetadataFactory {

    /**
     * Method to create the MeadataDetails objects collection from SFDX describe metadata types used in Aura Helper Connector. Can process the response directly or process a file with the response content
     * @param {String | Object} responseOrPath SFDX String response or JSON response or path to the file with the response data 
     * 
     * @returns {Array<MetadataDetail>} Array with the MetadataDetails for all metadata types received on the response
     * 
     * @throws {WrongFilePathException} If the path is not a String or cant convert to absolute path
     * @throws {FileNotFoundException} If the file not exists or not have access to it
     * @throws {InvalidFilePathException} If the path is not a file
     * @throws {WrongFormatException} If file is not a JSON file or the String response is not a JSON
     */
    static createMetadataDetails(responseOrPath) {
        let metadataTypes;
        if (Utils.isArray(responseOrPath)) {
            metadataTypes = responseOrPath;
        } else if (Utils.isString(responseOrPath)) {
            try {
                metadataTypes = JSON.parse(responseOrPath);
            } catch (errorParse) {
                try {
                    metadataTypes = Validator.validateJSONFile(responseOrPath)
                } catch (error) {
                    if (error.name === 'WrongFormatException')
                        error.message = 'The provided string response is not a JSON or file path';
                    throw error;
                }
            }
        }
        if (!metadataTypes)
            return [];
        if (metadataTypes.status === 0 && metadataTypes.result.metadataObjects)
            metadataTypes = metadataTypes.result.metadataObjects;
        const metadataDetails = [];
        if (metadataTypes !== undefined) {
            metadataTypes = Utils.forceArray(metadataTypes);
            for (const metadata of metadataTypes) {
                metadataDetails.push(new MetadataDetail(metadata));
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
     * @param {String} metadataTypeName Metadata Type API Name
     * @param {Array<Object>} records List of records to create the Metadata Types
     * @param {Object} foldersByType Object with the objects folders (email folders, document folders...) related by Metadata Type
     * @param {String} namespacePrefix Namespace prefix from the org
     * @param {Boolean} [addAll] true to add all elements in records list, false to add only your org namespace objects
     * 
     * @returns {MetadataType} Return a Metadata Type Object with the records data
     */
    static createMetadataTypeFromRecords(metadataTypeName, records, foldersByType, namespacePrefix, addAll) {
        const metadataType = new MetadataType(metadataTypeName);
        for (const record of records) {
            const folderDevName = getFolderDeveloperName(foldersByType[metadataTypeName], (record.FolderId || record.FolderName), metadataTypeName !== MetadataTypes.REPORT);
            if (folderDevName === undefined)
                continue;
            if (addAll || (!record.NamespacePrefix || record.NamespacePrefix === namespacePrefix)) {
                metadataType.addChild(folderDevName, new MetadataObject(folderDevName));
                metadataType.getChild(folderDevName).addChild(record.DeveloperName, new MetadataItem(record.DeveloperName));
            }
        }
        return metadataType;
    }

    /**
     * Method to create the Metadata Types from SFDX Command. Used in Aura Helper Connector to process the responses
     * @param {String} metadataTypeName Metadata Type API Name
     * @param {String | Object} response String response or JSON response from SFDX command
     * @param {String} namespacePrefix Namespace prefix from the org
     * @param {Boolean} [addAll] true to add all elements in response, false to add only your org namespace objects
     * 
     * @returns {MetadataType} Return a Metadata Type Object with the response data
     * 
     * @throws {WrongFormatException} If the response is not a JSON String or JSON Object
     */
    static createMetedataTypeFromResponse(metadataTypeName, response, namespacePrefix, addAll) {
        let metadataType;
        if (!response)
            return metadataType;
        if (Utils.isString(response)) {
            try {
                response = JSON.parse(response);
            } catch (error) {
                throw new WrongFormatException('The provided string response is not a JSON');
            }
        } else if (!Utils.isObject(response))
            throw new WrongFormatException('The provided response is not a JSON String or JSON Object');
        if (response.status === 0) {
            let dataList = Utils.forceArray(response.result);
            if (dataList === undefined)
                return undefined;
            metadataType = new MetadataType(metadataTypeName);
            createMetadataObjectsFromArray(metadataType, dataList, addAll, namespacePrefix, false);
        }
        return metadataType;
    }

    /**
     * Method to create not included Metadata Types into the responses of SFDX Commands like StandardValueSet for Standard Picklist values
     * @param {String} metadataTypeName Metadata Type API Name
     * 
     * @returns {MetadataType} Return the selected Metadata Type with childs data or undefined if not exists on not selected metadata types
     */
    static createNotIncludedMetadataType(metadataTypeName) {
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
     * @param {String} strJson String JSON response
     * 
     * @returns {SObject} Return an instance of the SObject or undefined if cant extract the data 
     */
    static createSObjectFromJSONSchema(strJson) {
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
            if (line.indexOf('{') !== -1)
                bracketIndent++;
            else if (line.indexOf('}') !== -1) {
                bracketIndent--;
                if (isOnRts) {
                    if (rt.developerName)
                        sObject.addRecordType(rt.developerName, rt);
                    rt = new RecordType();
                }
                if (isOnPicklistVal) {
                    if (pickVal.value)
                        field.addPicklistValue(pickVal);
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
                if (line.indexOf('fields') !== -1 && line.indexOf(':') !== -1 && line.indexOf('[') !== -1)
                    isOnFields = true;
                if (isOnFields && line.indexOf(']') !== -1 && line.indexOf('[') === -1) {
                    isOnFields = false;
                    isOnReference = false;
                    isOnPicklistVal = false;
                    if (field.name)
                        sObject.addField(field.name, field);
                    field = new SObjectField();
                }

                if (line.indexOf('recordTypeInfos') !== -1 && line.indexOf(':') !== -1 && line.indexOf('[') !== -1)
                    isOnRts = true;
                if (isOnRts && line.indexOf(']') !== -1 && line.indexOf('[') === -1) {
                    isOnRts = false;
                    if (rt.developerName)
                        sObject.addRecordType(rt.developerName, rt);
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
                if (keyValue.name === 'name')
                    sObject.setName(keyValue.value);
                if (keyValue.name === 'label')
                    sObject.setLabel(keyValue.value);
                if (keyValue.name === 'labelPlural')
                    sObject.setLabelPlural(keyValue.value);
                if (keyValue.name === 'keyPrefix')
                    sObject.setKeyPrefix(keyValue.value);
                if (keyValue.name === 'queryable')
                    sObject.setQueryable(keyValue.value);
                if (keyValue.name === 'custom')
                    sObject.setCustom(keyValue.value === 'true');
                if (keyValue.name === 'customSetting')
                    sObject.setCustomSetting(keyValue.value === 'true')
            } else if (isOnReference && line.indexOf('[') === -1) {
                field.addReferenceTo(StrUtils.replace(line, '"', '').trim());
            } else if (isOnPicklistVal && line.indexOf('[') === -1) {
                let keyValue = getJSONNameValuePair(line);
                if (keyValue.name === 'active')
                    pickVal.setActive(keyValue.value === 'true')
                if (keyValue.name === 'defaultValue')
                    pickVal.setDefaultValue(keyValue.value === 'true');
                if (keyValue.name === 'label')
                    pickVal.setLabel(keyValue.value);
                if (keyValue.name === 'value')
                    pickVal.setValue(keyValue.value);
            } else if (isOnFields && !isOnPicklistVal && !isOnReference) {
                if (bracketIndent === 3) {
                    let keyValue = getJSONNameValuePair(line);
                    if (keyValue.name === 'name')
                        field.setName(keyValue.value);
                    if (keyValue.name === 'label')
                        field.setLabel(keyValue.value);
                    if (keyValue.name === 'type')
                        field.setType(keyValue.value);
                    if (keyValue.name === 'length')
                        field.setLenght(keyValue.value)
                    if (keyValue.name === 'custom')
                        field.setCustom(keyValue.value === 'true')
                    if (keyValue.name === 'nillable')
                        field.setNillable(keyValue.value === 'true');
                    if (keyValue.name === 'relationshipName' && keyValue.value != 'null')
                        field.setRelationshipName(keyValue.value);
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
                    if (keyValue.name === 'name')
                        rt.setName(keyValue.value);
                    if (keyValue.name === 'developerName')
                        rt.setDeveloperName(keyValue.value);
                    if (keyValue.name === 'defaultRecordTypeMapping')
                        rt.setDefault(keyValue.value === 'true');
                    if (keyValue.name === 'master')
                        rt.setDefault(keyValue.value === 'true');
                }
            }
        }
        if (!sObject.name)
            return undefined;
        for (const fieldKey of Object.keys(sObject.fields)) {
            const field = sObject.fields[fieldKey];
            if (field.type && field.type.toLowerCase() === 'hierarchy' && !objField.referenceTo.includes(sObject.name))
                objField.referenceTo.push(sObject.name);
        }
        return sObject;
    }

    /**
     * Method to extract the SObjects data from the file system into an object with the SObject API Names in lower case as keys, and the SObject instance as value
     * @param {String} sObjectsPath Path to the SObjects folder
     * 
     * @returns {Object} Return an Object with the stored SObjects data with the name in lower case as key, and the SObject instance as value
     * 
     * @throws {WrongDirectoryPathException} If the sObjects path is not a String or can't convert to absolute path
     * @throws {DirectoryNotFoundException} If the directory not exists or not have access to it
     * @throws {InvalidDirectoryPathException} If the path is not a directory
     */
    static createSObjectsFromFileSystem(sObjectsPath) {
        const sObjects = {};
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
                newObject.labelPlural = !Utils.isNull(xmlObj.labelPlural) ? xmlObj.label : newObject.labelPlural;
                newObject.namespace = !Utils.isNull(xmlObj.namespace) ? xmlObj.label : newObject.namespace;
                newObject.customSetting = !Utils.isNull(xmlObj.customSettingsType);
            }
            if (FileChecker.isExists(fieldsFolder)) {
                const fields = FileReader.readDirSync(fieldsFolder);
                for (const field of fields) {
                    const xmlRoot = XMLParser.parseXML(FileReader.readFileSync(fieldsFolder + '/' + field));
                    const xmlField = xmlRoot['CustomField'];
                    const objField = new SObjectField(xmlField.fullName);
                    objField.label = !Utils.isNull(xmlField.label) ? xmlField.label : field;
                    objField.custom = field.endsWith('__c');
                    objField.length = !Utils.isNull(xmlField.length) ? xmlField.length : field;
                    objField.namespace = MetadataUtils.getNamespaceFromName(field);
                    objField.nillable = !Utils.isNull(xmlField.nillable) ? xmlField.nillable : true;
                    objField.referenceTo = !Utils.isNull(xmlField.referenceTo) ? Utils.forceArray(xmlField.referenceTo) : objField.referenceTo;
                    objField.relationshipName = field.endsWith('__c') ? field.substring(0, field.length - 2) + 'r' : objField.relationshipName;
                    objField.type = !Utils.isNull(xmlField.type) ? xmlField.type : objField.type;
                    if (objField.type && objField.type.toLowerCase() === 'hierarchy' && !objField.referenceTo.includes(newObject.name))
                        objField.referenceTo.push(newObject.name);
                    else if (objField.type && (objField.type.toLowerCase() === 'number' || objField.type.toLowerCase() === 'currency'))
                        objField.type = 'Decimal';
                    else if (objField.type && objField.type.toLowerCase() === 'checkbox')
                        objField.type = 'Boolean';
                    else if (objField.type && objField.type.toLowerCase() === 'datetime')
                        objField.type = 'DateTime';
                    else if (objField.type && objField.type.toLowerCase() === 'location')
                        objField.type = 'Location';
                    else if (objField.type && objField.type.toLowerCase() === 'date')
                        objField.type = 'Date';
                    else if (objField.type && objField.type.toLowerCase() === 'lookup')
                        objField.type = 'Lookup';
                    else
                        objField.type = 'String';
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

                    if (objField && objField.name)
                        newObject.addField(objField.name.toLowerCase(), objField);
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
                    if (objRT && objRT.developerName)
                        newObject.addRecordType(objRT.developerName.toLowerCase(), objRT);
                }
            }
            sObjects[newObject.name.toLowerCase()] = newObject;
        }
        return sObjects;
    }

    /**
     * Method to create a Map to relate the directory name to the related Metadata Detail. Including subtypes like SObejct fields, indexses...
     * @param {Array<MetadataDetail>} metadataDetails Metadata details list to create the Metadata Folder map
     * 
     * @returns {Object} Return an object with the directory name as key, and Metadata Detail as value
     */
    static createFolderMetadataMap(metadataDetails) {
        const folderMetadataMap = {};
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
            } else if (!folderMetadataMap[metadataDetail.directoryName]) {
                folderMetadataMap[metadataDetail.directoryName] = metadataDetail;
            }
        }
        return folderMetadataMap;
    }

    /**
     * Method to create the Metadata JSON Object with the files and data from your local project.
     * @param {Object | Array<MetadataDetail>} folderMapOrDetails Folder metadata map created with createFolderMetadataMap() method or MetadataDetails created with createMetadataDetails() method or downloaded with aura Helper Connector
     * @param {String} root Path to the Salesforce project root
     * 
     * @returns {Object} Returns a Metadata JSON Object with the data from the local project
     * 
     * @throws {WrongDirectoryPathException} If the root path is not a String or can't convert to absolute path
     * @throws {DirectoryNotFoundException} If the directory not exists or not have access to it
     * @throws {InvalidDirectoryPathException} If the path is not a directory
     */
    static createMetadataTypesFromFileSystem(folderMapOrDetails, root) {
        let metadata = {};
        let folderMetadataMap;
        root = Validator.validateFolderPath(root);
        if (Utils.isArray(folderMapOrDetails))
            folderMetadataMap = MetadataFactory.createFolderMetadataMap(folderMapOrDetails);
        else
            folderMetadataMap = folderMapOrDetails;
        let projectConfig = ProjectUtils.getProjectConfig(root);
        if (projectConfig === undefined) {
            projectConfig = {
                packageDirectories: [
                    {
                        path: root
                    }
                ]
            }
        }
        for (const packageDirectory of projectConfig.packageDirectories) {
            let directory = packageDirectory.path;
            if (packageDirectory.path !== root)
                directory = root + '/' + packageDirectory.path + '/main/default';
            if (!FileChecker.isExists(directory))
                continue;
            let folders = FileReader.readDirSync(directory);
            for (const folder of folders) {
                let metadataType = folderMetadataMap[folder];
                if (metadataType) {
                    let folderPath = directory + '/' + folder;
                    if (folder == 'objects') {
                        metadata = getCustomObjectsMetadata(metadata, folderPath);
                    } else if (folder == 'approvalProcesses') {
                        metadata[metadataType.xmlName] = getMetadataFromFolders(folderPath, metadataType, '.');
                    } else if (folder == 'customMetadata') {
                        metadata[metadataType.xmlName] = getMetadataFromFolders(folderPath, metadataType, '.');
                    } else if (folder == 'dashboards') {
                        metadata[metadataType.xmlName] = getDashboardsMetadataFromFolder(folderPath, metadataType);
                    } else if (folder == 'documents') {
                        metadata[metadataType.xmlName] = getDocumentsMetadataFromFolder(folderPath, metadataType);
                    } else if (folder == 'duplicateRules') {
                        metadata[metadataType.xmlName] = getMetadataFromFolders(folderPath, metadataType, '.');
                    } else if (folder == 'email') {
                        metadata[metadataType.xmlName] = getEmailTemplateMetadataFromFolder(folderPath, metadataType);
                    } else if (folder == 'flows') {
                        metadata[metadataType.xmlName] = getFlowsMetadataFromFolder(folderPath, metadataType);
                    } else if (folder == 'layouts') {
                        metadata[metadataType.xmlName] = getLayoutsMetadataFromFolder(folderPath, metadataType);
                    } else if (folder == 'objectTranslations') {
                        metadata[metadataType.xmlName] = getMetadataFromFolders(folderPath, metadataType, '-');
                    } else if (folder == 'reports') {
                        metadata[metadataType.xmlName] = getReportsMetadataFromFolder(folderPath, metadataType);
                    } else if (folder == 'quickActions') {
                        metadata[metadataType.xmlName] = getMetadataFromFolders(folderPath, metadataType, '.');
                    } else if (folder == 'standardValueSetTranslations') {
                        metadata[metadataType.xmlName] = getStandardValueSetTranslationMetadataFromFolder(folderPath, metadataType);
                    } else if (folder == 'lwc') {
                        let newMetadata = new MetadataType(metadataType.xmlName, false, folderPath, metadataType.suffix);
                        newMetadata.childs = getMetadataObjects(folderPath, true);
                        if (newMetadata.childs && Object.keys(newMetadata.childs).length > 0) {
                            metadata[metadataType.xmlName] = newMetadata;
                        }
                    } else if (folder == 'aura') {
                        let newMetadata = new MetadataType(metadataType.xmlName, false, folderPath, metadataType.suffix);
                        newMetadata.childs = getMetadataObjects(folderPath, true);
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
     * @param {String | Object} pathOrContent Path to the package file or XML String content or XML Parsed content (XMLParser)
     * 
     * @returns {Object} Return a Metadata JSON Object with the package data
     * 
     * @throws {WrongDirectoryPathException} If the path is not a String or can't convert to absolute path
     * @throws {DirectoryNotFoundException} If the directory not exists or not have access to it
     * @throws {InvalidDirectoryPathException} If the path is not a directory
     * @throws {WrongDatatypeException} If the parameter is not an String or valid XML Object parsed with XMLParser
     * @throws {WrongFormatException} If the provided data is not a correct Package XML file
     */
    static createMetadataTypesFromPackageXML(pathOrContent) {
        const metadataTypes = {};
        if (!pathOrContent)
            return metadataTypes;
        let xmlRoot = pathOrContent;
        if (Utils.isString(pathOrContent)) {
            try {
                try {
                    content = XMLParser.parseXML(FileReader.readFileSync(Validator.validateFilePath(filePathOrContent)));
                } catch (error) {
                    content = XMLParser.parseXML(filePathOrContent);
                }
            } catch (error) {
                throw new WrongDatatypeException('Wrong data parameter. Expect a package file path, XML Parsed content or XML String content but receive ' + pathOrContent);
            }
        } else if (!Utils.isObject(pathOrContent)) {
            throw new WrongDatatypeException('Wrong data parameter. Expect a package file path, XML Parsed content or XML String content but receive ' + pathOrContent);
        }
        if (!xmlRoot.Package && !xmlRoot.prepared)
            throw new WrongFormatException('Not a valid package.xml content. Check the file format');
        const preparedPackage = preparePackageFromXML(xmlRoot);
        for (const typeName of Object.keys(preparedPackage)) {
            if (typeName !== 'version' && typeName !== 'prepared') {
                let metadataType = new MetadataType(typeName);
                metadataType.checked = preparedPackage[typeName].includes('*');
                metadataType = createMetadataObjectsFromArray(metadataType, preparedPackage[typeName], true, undefined, true);
                metadataTypes[typeName] = metadataType;
            }
        }
        return metadataTypes;
    }

    /**
     * Method to create the Metadata JSON Object from the Git Diffs to able to create a Package from a git differences automatically and deploy it
     * @param {String} root Path to the Project Root
     * @param {Array<GitDiff>} gitDiffs List of git diffs extracted with Aura Helper Git Manager Module
     * @param {Object | Array<MetadataDetail>} folderMapOrDetails Folder metadata map created with createFolderMetadataMap() method or MetadataDetails created with createMetadataDetails() method or downloaded with aura Helper Connector
     * 
     * @returns {Object} Returns a Metadata JSON Object extracted from Git diffs 
     */
    static createMetadataTypesFromGitDiffs(root, gitDiffs, folderMapOrDetails) {
        let metadataRootFolder = root + '/force-app/main/default';
        let metadataForDeploy = {};
        let metadataForDelete = {};
        let folderMetadataMap;
        if (Utils.isArray(folderMapOrDetails))
            folderMetadataMap = MetadataFactory.createFolderMetadataMap(folderMapOrDetails);
        else
            folderMetadataMap = folderMapOrDetails;
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
            if (fistPartBaseFolder === 'lwc' && (fileNameWithExt === '.eslintrc.json' || fileNameWithExt === '.jsconfig.eslintrc.json'))
                continue;
            if (fistPartBaseFolder === 'objects') {
                metadataType = folderMetadataMap[fistPartBaseFolder + '/' + lastPartFolder];
            } else {
                metadataType = folderMetadataMap[baseFolder];
            }
            if (!metadataType) {
                metadataType = folderMetadataMap[fistPartBaseFolder];
            }
            if (!metadataType)
                continue;
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
                    let childs = getMetadataObjectsFromGitDiff(metadataType, baseFolderSplits, fileName, filePath);
                    if (!metadataForDeploy[metadata.name])
                        metadataForDeploy[metadata.name] = metadata;
                    Object.keys(childs).forEach(function (childKey) {
                        if (!metadataForDeploy[metadata.name].childs[childKey])
                            metadataForDeploy[metadata.name].childs[childKey] = childs[childKey];
                        if (childs[childKey].childs && Object.keys(childs[childKey].childs).length > 0) {
                            Object.keys(childs[childKey].childs).forEach(function (grandChildKey) {
                                if (!metadataForDeploy[metadata.name].childs[childKey].childs[grandChildKey])
                                    metadataForDeploy[metadata.name].childs[childKey].childs[grandChildKey] = childs[childKey].childs[grandChildKey];
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
                    let childs = getMetadataObjectsFromGitDiff(metadataType, baseFolderSplits, fileName, filePath);
                    if ((metadataType.xmlName === MetadataTypes.AURA_DEFINITION_BUNDLE && !fileNameWithExt.endsWith('.cmp') && !fileNameWithExt.endsWith('.evt') && !fileNameWithExt.endsWith('.app'))
                        || (metadataType.xmlName === MetadataTypes.LIGHTNING_COMPONENT_BUNDLE && !fileNameWithExt.endsWith('.html'))
                        || metadataType.xmlName === MetadataTypes.STATIC_RESOURCE && !fileNameWithExt.endsWith('.resource-meta.xml')) {
                        if (!metadataForDeploy[metadata.name])
                            metadataForDeploy[metadata.name] = metadata;
                        Object.keys(childs).forEach(function (childKey) {
                            if (!metadataForDeploy[metadata.name].childs[childKey])
                                metadataForDeploy[metadata.name].childs[childKey] = childs[childKey];
                            if (childs[childKey].childs && Object.keys(childs[childKey].childs).length > 0) {
                                Object.keys(childs[childKey].childs).forEach(function (grandChildKey) {
                                    if (!metadataForDeploy[metadata.name].childs[childKey].childs[grandChildKey])
                                        metadataForDeploy[metadata.name].childs[childKey].childs[grandChildKey] = childs[childKey].childs[grandChildKey];
                                });
                            }
                        });
                    } else {
                        if (!metadataForDelete[metadata.name])
                            metadataForDelete[metadata.name] = metadata;
                        Object.keys(childs).forEach(function (childKey) {
                            if (!metadataForDelete[metadata.name].childs[childKey])
                                metadataForDelete[metadata.name].childs[childKey] = childs[childKey];
                            else if (childs[childKey].checked) {
                                metadataForDelete[metadata.name].childs[childKey].checked = true;
                            }
                            if (childs[childKey].childs && Object.keys(childs[childKey].childs).length > 0) {
                                Object.keys(childs[childKey].childs).forEach(function (grandChildKey) {
                                    if (!metadataForDelete[metadata.name].childs[childKey].childs[grandChildKey])
                                        metadataForDelete[metadata.name].childs[childKey].childs[grandChildKey] = childs[childKey].childs[grandChildKey];
                                });
                            }
                        });
                    }
                }
            }
        }
        let typesForPriorDelete = [
            MetadataTypes.LIGHTNING_COMPONENT_BUNDLE,
            MetadataTypes.WORKFLOW,
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
        }
    }

    /**
     * Method to convert a JSON String with Metadata JSON format or a Metadata JSON untyped Object to a Metadata JSON Object with MetadataType, MetadataObject and MetadataItem objects
     * @param {String | Object} metadataTypes String or Object with Metadata JSON format to convert to typed Metadata JSON
     * @param {Boolean} [removeEmptyTypes] true to remove types with no data
     * 
     * @returns {Object} Return a JSON Metadata Object with MetadataType, MetadataObject and MetadataItem instances insted untyped objects
     * 
     * @throws {WrongFilePathException} If the filePath is not a String or can't convert to absolute path
     * @throws {FileNotFoundException} If the file not exists or not have access to it
     * @throws {InvalidFilePathException} If the path is not a file
     * @throws {WrongFormatException} If file is not a JSON file or not have the correct Metadata JSON format
     */
    static deserializeMetadataTypes(metadataTypes, removeEmptyTypes) {
        if (!metadataTypes)
            return metadataTypes;
        if (Utils.isString(metadataTypes)) {
            try {
                metadataTypes = JSON.parse(responseOrPath);
            } catch (error) {
                throw new WrongFormatException('The provided data must be a valid Metadata JSON Object');
            }
        }
        Validator.validateMetadataJSON(metadataTypes);
        const deserialized = {};
        Object.keys(metadataTypes).forEach((key) => {
            if (metadataTypes[key]) {
                const metadataType = new MetadataType(metadataTypes[key]);
                if (metadataTypes[key] && metadataTypes[key].childs && Object.keys(metadataTypes[key].childs).length > 0) {
                    Object.keys(metadataTypes[key].childs).forEach((childKey) => {
                        if (metadataTypes[key].childs[childKey]) {
                            metadataType.addChild(childKey, new MetadataObject(metadataTypes[key].childs[childKey]));
                            if (metadataTypes[key].childs[childKey] && metadataTypes[key].childs[childKey].childs && Object.keys(metadataTypes[key].childs[childKey].childs).length > 0) {
                                Object.keys(metadataTypes[key].childs[childKey].childs).forEach((grandChildKey) => {
                                    if (metadataTypes[key].childs[childKey].childs[grandChildKey]) {
                                        metadataType.getChild(childKey).addChild(grandChildKey, new MetadataItem(metadataTypes[key].childs[childKey].childs[grandChildKey]));
                                    }
                                });
                            }
                        }
                    });
                }
                if (metadataType.haveChilds() || (!metadataType.haveChilds() && !removeEmptyTypes)) {
                    deserialized[key] = metadataType;
                }
            }
        });
        return deserialized;
    }
}
module.exports = MetadataFactory;

function preparePackageFromXML(pkg, apiVersion) {
    let result = {};
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
    }
    return result;
}

function createMetadataObjectsFromArray(metadataType, dataList, downloadAll, namespacePrefix, fromPackage) {
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
            if (objName === '*')
                continue;
            if (objName.indexOf(separator) != -1) {
                name = objName.substring(0, objName.indexOf(separator));
                item = objName.substring(objName.indexOf(separator) + 1);
            } else {
                name = objName;
            }
            if (downloadAll) {
                if (!item) {
                    metadataType.addChild(name, new MetadataObject(name, fromPackage));
                } else {
                    metadataType.addChild(name, new MetadataObject(name, fromPackage));
                    metadataType.getChild(name).addChild(item, new MetadataItem(item, fromPackage));
                }
            } else {
                if (!item && (!obj.namespacePrefix || obj.namespacePrefix === namespacePrefix)) {
                    metadataType.addChild(name, new MetadataObject(name, fromPackage));
                } else if (!obj.namespacePrefix || obj.namespacePrefix === namespacePrefix) {
                    metadataType.addChild(name, new MetadataObject(name, fromPackage));
                    metadataType.getChild(name).addChild(item, new MetadataItem(item, fromPackage));
                }
            }
        }
    }
    return metadataType;
}

function getJSONNameValuePair(line) {
    let tmpLine = StrUtils.replace(StrUtils.replace(line, '}', ''), '{', '');
    if (tmpLine.indexOf('[') !== -1 && tmpLine.indexOf(']') === -1)
        tmpLine = StrUtils.replace(tmpLine, '[', '');
    let splits = tmpLine.split(':');
    let fieldName;
    let fieldValue;
    if (splits.length >= 0 && splits[0]) {
        fieldName = StrUtils.replace(StrUtils.replace(splits[0].trim(), "'", ''), '"', '');
    }
    if (splits.length >= 1 && splits[1]) {
        fieldValue = StrUtils.replace(StrUtils.replace(splits[1].trim(), "'", ''), '"', '');
        if (fieldValue.endsWith(","))
            fieldValue = fieldValue.substring(0, fieldValue.length - 1);
        else
            fieldValue = fieldValue.substring(0, fieldValue.length);
    }
    return {
        name: fieldName,
        value: fieldValue
    };
}

function getFolderDeveloperName(folders, idOrName, searchById) {
    if (folders) {
        if (idOrName === 'Private Reports')
            return undefined;
        for (const folder of folders) {
            if (searchById && folder.Id && idOrName && folder.Id === idOrName) {
                return folder.DeveloperName;
            } else if (!searchById && folder.Name && idOrName && folder.Name === idOrName && idOrName !== undefined) {
                return folder.DeveloperName
            }
        }
    }
    return UNFILED_PUBLIC_FOLDER;
}

function getMetadataFromFiles(metadataType, metadata, folderPath) {
    let mainObject = new MetadataType(metadataType.xmlName, false, folderPath, metadataType.suffix);
    mainObject.childs = getMetadataObjects(folderPath, false);
    metadata[metadataType.xmlName] = mainObject;
    let files = FileReader.readDirSync(folderPath);
    let collectionsData = METADATA_XML_RELATION[metadataType.xmlName];
    for (const file of files) {
        let path = folderPath + '/' + file;
        let xmlData = XMLParser.parseXML(FileReader.readFileSync(path));
        if (metadataType.xmlName === MetadataTypes.CUSTOM_LABELS) {
            if (xmlData[metadataType.xmlName]) {
                Object.keys(collectionsData).forEach(function (collectionName) {
                    let collectionData = collectionsData[collectionName];
                    if (xmlData[metadataType.xmlName][collectionName]) {
                        xmlData[metadataType.xmlName][collectionName] = Utils.forceArray(xmlData[metadataType.xmlName][collectionName]);
                        for (let xmlElement of xmlData[metadataType.xmlName][collectionName]) {
                            let elementKey = xmlElement[collectionData.fieldKey];
                            if (!metadata[collectionData.type])
                                metadata[collectionData.type] = new MetadataType(collectionData.type, false, folderPath, metadataType.suffix);
                            if (!metadata[collectionData.type].childs[elementKey])
                                metadata[collectionData.type].childs[elementKey] = new MetadataObject(elementKey, false, path);
                        }
                    }
                });
            }
        } else {
            if (xmlData[metadataType.xmlName]) {
                Object.keys(collectionsData).forEach(function (collectionName) {
                    let collectionData = collectionsData[collectionName];
                    if (xmlData[metadataType.xmlName][collectionName]) {
                        let sObj = file.substring(0, file.indexOf('.'));
                        if (!metadata[collectionData.type])
                            metadata[collectionData.type] = new MetadataType(collectionData.type, false, folderPath, metadataType.suffix);
                        if (!metadata[collectionData.type].childs[sObj])
                            metadata[collectionData.type].childs[sObj] = new MetadataObject(sObj, false);
                        xmlData[metadataType.xmlName][collectionName] = Utils.forceArray(xmlData[metadataType.xmlName][collectionName]);
                        for (let xmlElement of xmlData[metadataType.xmlName][collectionName]) {
                            let elementKey = xmlElement[collectionData.fieldKey];
                            if (!metadata[collectionData.type].childs[sObj].childs[elementKey])
                                metadata[collectionData.type].childs[sObj].childs[elementKey] = new MetadataItem(elementKey, false, path);
                        }
                    }
                });
            }
        }
    }
}

function getMetadataFromFolders(folderPath, type, separator) {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(type.xmlName, false, folderPath, type.suffix);
    let metadataObjects = {};
    for (const file of files) {
        let path = folderPath + '/' + file;
        let fileParts = file.split(separator);
        let sObj = fileParts[0];
        let metadataName = fileParts[1];
        if (!metadataObjects[sObj])
            metadataObjects[sObj] = new MetadataObject(sObj, false, folderPath);
        if (metadataName && metadataName.length > 0 && !metadataObjects[sObj].childs[metadataName])
            metadataObjects[sObj].childs[metadataName] = new MetadataItem(metadataName, false, path);
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getDashboardsMetadataFromFolder(folderPath, type) {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(type.xmlName, false, folderPath, type.suffix);
    let metadataObjects = {};
    for (const dashboardFolder of files) {
        let fPath = folderPath + '/' + dashboardFolder;
        if (dashboardFolder.indexOf('.') === -1) {
            if (!metadataObjects[dashboardFolder])
                metadataObjects[dashboardFolder] = new MetadataObject(dashboardFolder, false, fPath);
            let dashboards = FileReader.readDirSync(fPath);
            for (const dashboard of dashboards) {
                let path = fPath + '/' + dashboard;
                let name = dashboard.substring(0, dashboard.indexOf('.'));
                if (name && name.length > 0 && !metadataObjects[dashboardFolder].childs[name])
                    metadataObjects[dashboardFolder].childs[name] = new MetadataItem(name, false, path);
            }
        }
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getReportsMetadataFromFolder(folderPath, type) {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(type.xmlName, false, folderPath, type.suffix);
    let metadataObjects = {};
    for (const reportsFolder of files) {
        let fPath = folderPath + '/' + reportsFolder;
        if (reportsFolder.indexOf('.') === -1) {
            if (!metadataObjects[reportsFolder])
                metadataObjects[reportsFolder] = new MetadataObject(reportsFolder, false, fPath);
            let reports = FileReader.readDirSync(fPath);
            for (const report of reports) {
                let path = fPath + '/' + report;
                let name = report.substring(0, report.indexOf('.'));
                if (name && name.length > 0 && !metadataObjects[reportsFolder].childs[name])
                    metadataObjects[reportsFolder].childs[name] = new MetadataItem(name, false, path);
            }
        }
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getDocumentsMetadataFromFolder(folderPath, type) {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(type.xmlName, false, folderPath, type.suffix);
    let metadataObjects = {};
    for (const docFolder of files) {
        let fPath = folderPath + '/' + docFolder;
        if (docFolder.indexOf('.') === -1) {
            if (!metadataObjects[docFolder])
                metadataObjects[docFolder] = new MetadataObject(docFolder, false, fPath);
            let docs = FileReader.readDirSync(fPath);
            for (const doc of docs) {
                let path = fPath + '/' + doc;
                if (doc.indexOf('.document-meta.xml') === -1) {
                    if (doc && doc.length > 0 && !metadataObjects[docFolder].childs[doc])
                        metadataObjects[docFolder].childs[doc] = new MetadataItem(doc, false, path);
                }
            }
        }
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getEmailTemplateMetadataFromFolder(folderPath, type) {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(type.xmlName, false, folderPath, type.suffix);
    let metadataObjects = {};
    for (const emailFolder of files) {
        let fPath = folderPath + '/' + emailFolder;
        if (emailFolder.indexOf('.') === -1) {
            if (!metadataObjects[emailFolder])
                metadataObjects[emailFolder] = new MetadataObject(emailFolder, false, fPath);
            let emails = FileReader.readDirSync(folderPath + '/' + emailFolder);
            for (const email of emails) {
                let path = fPath + '/' + email;
                let name = email.substring(0, email.indexOf('.'));
                if (name && name.length > 0 && !metadataObjects[emailFolder].childs[name])
                    metadataObjects[emailFolder].childs[name] = new MetadataItem(name, false, path);
            }
        }
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getFlowsMetadataFromFolder(folderPath, type) {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(type.xmlName, false, folderPath, type.suffix);
    let metadataObjects = {};
    for (const flowFile of files) {
        let path = folderPath + '/' + flowFile;
        let name = flowFile.substring(0, flowFile.indexOf('.'));
        let flow = undefined
        let version = undefined;
        if (name.indexOf('-') !== -1) {
            flow = name.substring(0, name.indexOf('-')).trim();
            version = name.substring(name.indexOf('-') + 1).trim();
        } else {
            flow = name.trim();
        }
        if (!metadataObjects[flow])
            metadataObjects[flow] = new MetadataObject(flow, false, ((version !== undefined) ? folderPath : path));
        if (version && version.length > 0)
            metadataObjects[flow].childs[version] = new MetadataItem(version, false, path);
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getStandardValueSetTranslationMetadataFromFolder(folderPath, type) {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(type.xmlName, false, folderPath);
    let metadataObjects = {};
    for (const translationFile of files) {
        let path = folderPath + '/' + translationFile;
        let name = translationFile.substring(0, translationFile.indexOf('.'));
        let translation = undefined
        let version = undefined;
        if (name.indexOf('-') !== -1) {
            translation = name.substring(0, name.indexOf('-')).trim();
            version = name.substring(name.indexOf('-') + 1).trim();
        }
        if (!metadataObjects[translation])
            metadataObjects[translation] = new MetadataObject(translation, false, folderPath);
        if (version && version.length > 0)
            metadataObjects[translation].childs[version] = new MetadataItem(version, false, path);
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getLayoutsMetadataFromFolder(folderPath, type) {
    let files = FileReader.readDirSync(folderPath);
    let metadataType = new MetadataType(type.xmlName, false, folderPath, type.suffix);
    let metadataObjects = {};
    for (const layoutFile of files) {
        let path = folderPath + '/' + layoutFile;
        let name = layoutFile.substring(0, layoutFile.indexOf('.'));
        let sObj = name.substring(0, name.indexOf('-')).trim();
        let layout = name.substring(name.indexOf('-') + 1).trim();
        if (!metadataObjects[sObj])
            metadataObjects[sObj] = new MetadataObject(sObj, false, folderPath);
        if (layout && layout.length > 0)
            metadataObjects[sObj].childs[layout] = new MetadataItem(layout, false, path);
    }
    metadataType.childs = metadataObjects;
    return metadataType;
}

function getCustomObjectsMetadata(metadata, objectsPath) {
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

function getMetadataObjects(folderPath, onlyFolders) {
    let objects;
    if (FileChecker.isExists(folderPath)) {
        let files = FileReader.readDirSync(folderPath);
        if (files.length > 0)
            objects = {}
        for (const file of files) {
            let path = folderPath + '/' + file;
            if (onlyFolders && file.indexOf('.') == -1) {
                if (!objects[file])
                    objects[file] = new MetadataObject(file, false, path);
            } else if (!onlyFolders) {
                let name = file.substring(0, file.indexOf('.'));
                if (!objects[name])
                    objects[name] = new MetadataObject(name, false, path);
            }
        }
    }
    return objects;
}

function getMetadataItems(folderPath) {
    let items = {};
    if (FileChecker.isExists(folderPath)) {
        let files = FileReader.readDirSync(folderPath);
        for (const file of files) {
            let path = folderPath + '/' + file;
            if (FileChecker.isFile(path)) {
                let name = file.substring(0, file.indexOf('.'));
                if (!items[name])
                    items[name] = new MetadataItem(name, false, path);
            }
        }
    }
    return items;
}

function analizeDiffChanges(diffChanges, metadata, metadataType, fileName, filePath) {
    let added = true;
    let possibleMetadataToAdd;
    let typePath = filePath.substring(0, filePath.indexOf('/' + metadataType.directoryName));
    typePath = typePath + '/' + metadataType.directoryName;
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
                startCollectionTag = getChildTypeStartTag(metadataType.xmlName, changedLine);
            }
            if (startCollectionTag) {
                collectionData = METADATA_XML_RELATION[metadataType.xmlName][startCollectionTag];
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
            if (startCollectionTag && !endCollectionTag)
                endCollectionTag = XMLParser.endTag(changedLine, startCollectionTag);
            if (endCollectionTag) {
                if (!collectionData)
                    collectionData = METADATA_XML_RELATION[metadataType.xmlName][endCollectionTag];
                fullNameContent = StrUtils.replace(fullNameContent, ',', '').trim();
                if (fullNameContent.length > 0) {
                    let type = collectionData.type;
                    if (!metadata[type])
                        metadata[type] = new MetadataType(type, true, typePath, metadataType.suffix);
                    if (metadataType.xmlName === MetadataTypes.CUSTOM_LABELS) {
                        if (!metadata[type].childs[fullNameContent])
                            metadata[type].childs[fullNameContent] = new MetadataObject(fullNameContent, true, filePath);
                    } else {
                        if (!metadata[type].childs[fileName])
                            metadata[type].childs[fileName] = new MetadataObject(fileName, true, filePath);
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
        possibleMetadataToAdd[metadataType.xmlName] = new MetadataType(metadataType.xmlName, true, typePath, metadataType.suffix);
        if (!possibleMetadataToAdd[metadataType.xmlName].childs[fileName])
            possibleMetadataToAdd[metadataType.xmlName].childs[fileName] = new MetadataObject(fileName, true, filePath);
    }
    return possibleMetadataToAdd;
}

function getMetadataObjectsFromGitDiff(metadataType, baseFolderSplits, fileName, filePath) {
    let especialTypes = [MetadataTypes.CUSTOM_METADATA, MetadataTypes.APPROVAL_PROCESSES, MetadataTypes.DUPLICATE_RULE,
    MetadataTypes.QUICK_ACTION, MetadataTypes.LAYOUT, MetadataTypes.AURA_DEFINITION_BUNDLE, MetadataTypes.LIGHTNING_COMPONENT_BUNDLE, MetadataTypes.ASSIGNMENT_RULES, MetadataTypes.AUTORESPONSE_RULES,
    MetadataTypes.WORKFLOW, MetadataTypes.CUSTOM_LABELS, MetadataTypes.SHARING_RULES, MetadataTypes.FLOW, MetadataTypes.CUSTOM_OBJECT_TRANSLATIONS, MetadataTypes.STATIC_RESOURCE];
    let objects = {};
    let fistPartBaseFolder = baseFolderSplits[0];
    let folderPath = PathUtils.getBasename(filePath);
    if (baseFolderSplits.length > 1 && !especialTypes.includes(metadataType.xmlName)) {
        let metadataObjectFolderName = baseFolderSplits[1];
        if (fileName.indexOf('Folder-meta.xml') === -1) {
            if (metadataType.xmlName === MetadataTypes.DOCUMENT) {
                if (fileName.indexOf('-meta.xml') === -1) {
                    if (!objects[metadataObjectFolderName])
                        objects[metadataObjectFolderName] = new MetadataObject(metadataObjectFolderName, false, filePath);
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
                if (!objects[metadataObjectFolderName])
                    objects[metadataObjectFolderName] = new MetadataObject(metadataObjectFolderName, false, filePath);
                if (metadataType.xmlName !== MetadataTypes.CUSTOM_OBJECT) {
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
            if (!objects[fileName])
                objects[fileName] = new MetadataObject(fileName, true, filePath);
            else
                objects[fileName].checked = true;
        }
    } else if (metadataType.xmlName === MetadataTypes.CUSTOM_METADATA || metadataType.xmlName === MetadataTypes.APPROVAL_PROCESSES || metadataType.xmlName === MetadataTypes.DUPLICATE_RULE || metadataType.xmlName === MetadataTypes.QUICK_ACTION) {
        let fileNameParts = fileName.split('.');
        let sobj = fileNameParts[0].trim();
        let item = fileNameParts[1].trim();
        if (!objects[sobj])
            objects[sobj] = new MetadataObject(sobj, true, folderPath);
        if (!objects[sobj].childs[item])
            objects[sobj].childs[item] = new MetadataItem(item, true, filePath);
    } else if (metadataType.xmlName === MetadataTypes.LAYOUT || metadataType.xmlName === MetadataTypes.STANDARD_VALUE_SET_TRANSLATION) {
        let sobj = fileName.substring(0, fileName.indexOf('-')).trim();
        let item = fileName.substring(fileName.indexOf('-') + 1).trim();
        if (!objects[sobj])
            objects[sobj] = new MetadataObject(sobj, true, folderPath);
        if (!objects[sobj].childs[item])
            objects[sobj].childs[item] = new MetadataItem(item, true, filePath);
    } else if (metadataType.xmlName === MetadataTypes.CUSTOM_OBJECT_TRANSLATIONS) {
        let folderName = baseFolderSplits[0];
        let sobj = folderName.substring(0, folderName.indexOf('-')).trim();
        let item = folderName.substring(folderName.indexOf('-') + 1).trim();
        let lastFolder = PathUtils.getBasename(folderPath);
        if (!objects[sobj])
            objects[sobj] = new MetadataObject(sobj, true, lastFolder);
        if (!objects[sobj].childs[item])
            objects[sobj].childs[item] = new MetadataItem(item, true, folderPath);
    } else if (metadataType.xmlName === MetadataTypes.STATIC_RESOURCE) {
        let resourcePath = filePath.substring(0, filePath.indexOf('/' + metadataType.directoryName));
        resourcePath = resourcePath + '/' + metadataType.directoryName + '/' + baseFolderSplits[1 + '.' + metadataType.suffix + '-meta.xml'];
        if (baseFolderSplits.length === 1) {
            if (!objects[fileName])
                objects[fileName] = new MetadataObject(fileName, true, resourcePath);
        } else {
            if (!objects[baseFolderSplits[1]])
                objects[baseFolderSplits[1]] = new MetadataObject(baseFolderSplits[1], true, resourcePath);
        }
    } else if (metadataType.xmlName === MetadataTypes.FLOW) {
        if (fileName.indexOf('-') !== -1) {
            let sobj = fileName.substring(0, fileName.indexOf('-')).trim();
            let item = fileName.substring(fileName.indexOf('-') + 1).trim();
            if (!objects[sobj])
                objects[sobj] = new MetadataObject(sobj, true, folderPath);
            if (!objects[sobj].childs[item])
                objects[sobj].childs[item] = new MetadataItem(item, true, filePath);
        } else {
            if (!objects[fileName])
                objects[fileName] = new MetadataObject(fileName, true, filePath);
        }
    } else if (metadataType.xmlName === MetadataTypes.AURA_DEFINITION_BUNDLE || metadataType.xmlName === MetadataTypes.LIGHTNING_COMPONENT_BUNDLE) {
        if (baseFolderSplits[1] && !objects[baseFolderSplits[1]])
            objects[baseFolderSplits[1]] = new MetadataObject(baseFolderSplits[1], true, folderPath);
    } else {
        if (fileName.indexOf('Folder-meta.xml') !== -1) {
            fileName = StrUtils.replace(fileName, '-meta.xml', '');
            fileName = fileName.substring(0, fileName.lastIndexOf('.'));
            if (!objects[fileName])
                objects[fileName] = new MetadataObject(fileName, true, filePath);
            else
                objects[fileName].checked = true;
        } else {
            if (!objects[fileName])
                objects[fileName] = new MetadataObject(fileName, true, filePath);
        }
    }
    return objects;
}

function getChildTypeStartTag(metadataType, content) {
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

function priorMetadataTypes(types, metadataToPrior, metadataToRemove) {
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